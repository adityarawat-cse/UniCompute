package edu.unicompute.api.jobs;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import edu.unicompute.api.nodes.ClusterNode;
import edu.unicompute.api.nodes.NodeService;
import edu.unicompute.api.persistence.entity.JobEntity;
import edu.unicompute.api.persistence.entity.JobExecutionEntity;
import edu.unicompute.api.persistence.repository.JobExecutionRepository;
import edu.unicompute.api.persistence.repository.JobRepository;
import edu.unicompute.api.users.UserResponse;
import edu.unicompute.api.users.UserService;
import edu.unicompute.api.worker.WorkerJobManifest;
import edu.unicompute.api.worker.WorkerResultRequest;

@Service
public class JobService {

    private static final Logger log = LoggerFactory.getLogger(JobService.class);

    private final Map<UUID, Job> jobs = new ConcurrentHashMap<>();
    private final NodeService nodeService;
    private final JobRepository jobRepository;
    private final JobExecutionRepository executionRepository;
    private final UserService userService;
    private final ReentrantLock schedulingLock = new ReentrantLock();

    @Autowired
    public JobService(
            NodeService nodeService,
            @Autowired(required = false) JobRepository jobRepository,
            @Autowired(required = false) JobExecutionRepository executionRepository,
            @Autowired(required = false) UserService userService) {
        this.nodeService = nodeService;
        this.jobRepository = jobRepository;
        this.executionRepository = executionRepository;
        this.userService = userService;
        initFromDatabase();
    }

    public JobService(NodeService nodeService) {
        this(nodeService, null, null, null);
    }

    private void initFromDatabase() {
        if (jobRepository != null) {
            try {
                List<JobEntity> persistedJobs = jobRepository.findAll();
                for (JobEntity entity : persistedJobs) {
                    try {
                        String stdout = "";
                        String stderr = "";
                        Integer exitCode = null;
                        String errMsg = null;
                        Long duration = null;

                        if (executionRepository != null) {
                            Optional<JobExecutionEntity> exec = executionRepository.findTopByJobIdOrderByExecutedAtDesc(entity.getJobId());
                            if (exec.isPresent()) {
                                stdout = exec.get().getStdout() != null ? exec.get().getStdout() : "";
                                stderr = exec.get().getStderr() != null ? exec.get().getStderr() : "";
                                exitCode = exec.get().getExitCode();
                                errMsg = exec.get().getErrorMessage();
                                duration = exec.get().getDurationMs();
                            }
                        }

                        Job job = entity.toDomain(duration, stdout, stderr, exitCode, errMsg);
                        jobs.put(job.jobId(), job);
                    } catch (Exception e) {
                        log.warn("Could not deserialize persisted job {}: {}", entity.getJobId(), e.getMessage());
                    }
                }
                log.info("Initialized {} jobs with execution logs from MySQL database.", jobs.size());
            } catch (Exception e) {
                log.warn("Database initialization skipped or unavailable: {}", e.getMessage());
            }
        }
    }

    private void persistJob(Job job) {
        if (jobRepository != null && job != null) {
            try {
                JobEntity entity = JobEntity.fromDomain(job);
                jobRepository.save(entity);
            } catch (Exception e) {
                log.error("Failed to persist job {} to database: {}", job.jobId(), e.getMessage());
            }
        }
    }

    public Job submit(JobSubmissionRequest request) {
        UUID jobId = UUID.randomUUID();

        // B-3: Upfront quota check and reservation
        if (userService != null && request.userId() != null) {
            Optional<UserResponse> userOpt = userService.findById(request.userId());
            if (userOpt.isPresent()) {
                UserResponse u = userOpt.get();
                int remaining = Math.max(0, u.dailyQuotaSeconds() - u.usedQuotaSeconds());
                if (remaining < request.maxExecutionTimeSeconds()) {
                    throw new IllegalArgumentException("Insufficient daily compute quota! Requested "
                            + request.maxExecutionTimeSeconds() + "s but only " + remaining + "s remain in daily balance.");
                }
                userService.recordUsage(request.userId(), request.maxExecutionTimeSeconds());
                log.info("B-3 Quota: Reserved {}s quota for user {} (job {})", request.maxExecutionTimeSeconds(), request.userId(), jobId);
            }
        }

        Job job = new Job(
                jobId,
                request.jobName(),
                request.language().toUpperCase(),
                request.sourceCode(),
                request.cpuCores(),
                request.memoryMb(),
                request.storageMb(),
                request.maxExecutionTimeSeconds(),
                request.priority(),
                request.schedulingAlgorithm(),
                JobStatus.QUEUED,
                Instant.now(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                0,
                request.userId()
        );

        jobs.put(jobId, job);
        persistJob(job);
        return job;
    }

    public List<Job> findAll() {
        checkLeaseTimeouts();
        return jobs.values().stream()
                .sorted(Comparator.comparing(Job::submittedAt).thenComparing(Job::jobId))
                .toList();
    }

    public Optional<Job> findById(UUID jobId) {
        return Optional.ofNullable(jobs.get(jobId));
    }

    public Optional<WorkerJobManifest> pollAndAssignJob(ClusterNode workerNode, int availableCores, int availableMemoryMb) {
        schedulingLock.lock();
        try {
            checkLeaseTimeouts();

            // Check if node is online and ready
            if (!workerNode.online() || !"Available".equalsIgnoreCase(workerNode.status()) || workerNode.activeJobId() != null) {
                return Optional.empty();
            }

            // Find first matching QUEUED job based on priority and submission time
            Optional<Job> candidate = jobs.values().stream()
                    .filter(j -> j.status() == JobStatus.QUEUED)
                    .filter(j -> !("PYTHON".equalsIgnoreCase(j.language()) && !workerNode.pythonAvailable()))
                    .filter(j -> !("JAVA".equalsIgnoreCase(j.language()) && !workerNode.javaAvailable()))
                    .filter(j -> j.cpuCores() <= availableCores && j.cpuCores() <= workerNode.cores())
                    .filter(j -> j.memoryMb() <= availableMemoryMb && (j.memoryMb() <= workerNode.memoryGb() * 1024L))
                    .min(Comparator.comparingInt(Job::priority).reversed().thenComparing(Job::submittedAt));

            if (candidate.isEmpty()) {
                return Optional.empty();
            }

            Job job = candidate.get();
            Instant now = Instant.now();
            Instant leaseExpiry = now.plusSeconds(30);

            // Reserve job and node atomically
            Job assigned = job.withAssigned(workerNode.id(), workerNode.name(), leaseExpiry);
            jobs.put(assigned.jobId(), assigned);
            persistJob(assigned);
            nodeService.setNodeBusy(workerNode.id(), assigned.jobId());

            return Optional.of(new WorkerJobManifest(
                    assigned.jobId(),
                    assigned.jobName(),
                    assigned.language(),
                    assigned.sourceCode(),
                    assigned.cpuCores(),
                    assigned.memoryMb(),
                    assigned.maxExecutionTimeSeconds()
            ));
        } finally {
            schedulingLock.unlock();
        }
    }

    public boolean acknowledgeStart(UUID jobId, String nodeId) {
        schedulingLock.lock();
        try {
            Job job = jobs.get(jobId);
            if (job == null || job.status() != JobStatus.ASSIGNED) {
                return false;
            }
            if (!nodeId.equalsIgnoreCase(job.assignedNodeId())) {
                return false;
            }

            Job running = job.withRunning(Instant.now());
            jobs.put(jobId, running);
            persistJob(running);
            return true;
        } finally {
            schedulingLock.unlock();
        }
    }

    public boolean recordResult(WorkerResultRequest req, String nodeId) {
        schedulingLock.lock();
        try {
            Job job = jobs.get(req.jobId());
            if (job == null) {
                return false;
            }

            // If job already completed, be idempotent
            if (job.status() == JobStatus.COMPLETED || job.status() == JobStatus.FAILED) {
                return true;
            }

            // If job was cancelled by user, reject completion
            if (job.status() == JobStatus.CANCELLED) {
                nodeService.setNodeAvailable(nodeId);
                return false;
            }

            long duration = req.executionDurationMs() != null ? req.executionDurationMs() : 0L;
            int exitCode = req.exitCode() != null ? req.exitCode() : 0;
            String out = req.stdout() != null ? req.stdout() : "";
            String err = req.stderr() != null ? req.stderr() : "";

            Job finished;
            if ("COMPLETED".equalsIgnoreCase(req.status()) && exitCode == 0) {
                finished = job.withCompleted(duration, exitCode, out, err);
            } else {
                String errorMsg = !err.isBlank() ? err : "Process exited with non-zero code: " + exitCode;
                finished = job.withFailed(duration, exitCode, out, err, errorMsg);
            }

            jobs.put(job.jobId(), finished);
            persistJob(finished);

            if (executionRepository != null) {
                try {
                    JobExecutionEntity exec = new JobExecutionEntity();
                    exec.setJobId(job.jobId().toString());
                    exec.setServerId(nodeId);
                    exec.setExitCode(exitCode);
                    exec.setDurationMs(duration);
                    exec.setStdout(out);
                    exec.setStderr(err);
                    exec.setErrorMessage("COMPLETED".equalsIgnoreCase(req.status()) && exitCode == 0 ? null : finished.errorMessage());
                    executionRepository.save(exec);
                    log.info("Persisted execution log for job {} with exitCode={}", job.jobId(), exitCode);
                } catch (Exception e) {
                    log.error("Failed to record execution entity for job {}: {}", job.jobId(), e.getMessage());
                }
            }

            // B-3: Actual Usage Quota Accounting & Refunds
            if (userService != null && job.userId() != null) {
                int requestedSeconds = job.maxExecutionTimeSeconds();
                int actualSeconds = (int) Math.ceil(duration / 1000.0);

                if (actualSeconds < requestedSeconds) {
                    // Early finish: refund unused quota back to user
                    int refundSeconds = requestedSeconds - actualSeconds;
                    userService.refundUsage(job.userId(), refundSeconds);
                    log.info("B-3 Quota Refund: Job {} finished in {}s (requested {}s). Refunded {}s to user {}",
                            job.jobId(), actualSeconds, requestedSeconds, refundSeconds, job.userId());
                } else if (actualSeconds > requestedSeconds) {
                    // Overrun protection: deduct extra overrun seconds from remaining quota
                    int overrunSeconds = actualSeconds - requestedSeconds;
                    userService.recordUsage(job.userId(), overrunSeconds);
                    log.info("B-3 Overrun Protection: Job {} took {}s (requested {}s). Deducted extra {}s from user {}",
                            job.jobId(), actualSeconds, requestedSeconds, overrunSeconds, job.userId());
                }
            } else if (userService != null && duration > 0) {
                int durationSeconds = (int) Math.ceil(duration / 1000.0);
                if (jobRepository != null) {
                    jobRepository.findById(job.jobId().toString()).ifPresent(entity -> {
                        if (entity.getUserId() != null) {
                            userService.recordUsage(entity.getUserId(), durationSeconds);
                        }
                    });
                }
            }

            nodeService.setNodeAvailable(nodeId);
            return true;
        } finally {
            schedulingLock.unlock();
        }
    }

    public boolean cancelJob(UUID jobId) {
        schedulingLock.lock();
        try {
            Job job = jobs.get(jobId);
            if (job == null || job.status() == JobStatus.COMPLETED || job.status() == JobStatus.FAILED) {
                return false;
            }

            Job cancelled = job.withCancelled();
            jobs.put(jobId, cancelled);
            persistJob(cancelled);

            // B-3: Refund reserved quota on cancellation if not already executed
            if (userService != null && job.userId() != null && (job.status() == JobStatus.QUEUED || job.status() == JobStatus.ASSIGNED)) {
                userService.refundUsage(job.userId(), job.maxExecutionTimeSeconds());
                log.info("B-3 Cancellation Refund: Refunded {}s quota to user {} for cancelled job {}",
                        job.maxExecutionTimeSeconds(), job.userId(), jobId);
            }

            if (executionRepository != null) {
                try {
                    JobExecutionEntity exec = new JobExecutionEntity();
                    exec.setJobId(job.jobId().toString());
                    exec.setServerId(job.assignedNodeId());
                    exec.setExitCode(-1);
                    exec.setDurationMs(0L);
                    exec.setStdout("");
                    exec.setStderr("Job was cancelled by user.");
                    exec.setErrorMessage("Job cancelled by user.");
                    executionRepository.save(exec);
                } catch (Exception e) {
                    log.error("Failed to record cancellation execution for job {}: {}", job.jobId(), e.getMessage());
                }
            }

            if (job.assignedNodeId() != null) {
                nodeService.setNodeAvailable(job.assignedNodeId());
            }
            return true;
        } finally {
            schedulingLock.unlock();
        }
    }

    public void checkLeaseTimeouts() {
        Instant now = Instant.now();
        for (Job job : jobs.values()) {
            if (job.status() == JobStatus.ASSIGNED && job.leaseExpiresAt() != null && job.leaseExpiresAt().isBefore(now)) {
                schedulingLock.lock();
                try {
                    Job current = jobs.get(job.jobId());
                    if (current != null && current.status() == JobStatus.ASSIGNED && current.leaseExpiresAt().isBefore(now)) {
                        if (current.retryCount() < 3) {
                            Job requeued = current.withRetryReset();
                            jobs.put(requeued.jobId(), requeued);
                            persistJob(requeued);
                        } else {
                            Job failed = current.withFailed(0, -1, "", "", "Worker node failed to acknowledge job within 30s lease.");
                            jobs.put(failed.jobId(), failed);
                            persistJob(failed);

                            if (executionRepository != null) {
                                try {
                                    JobExecutionEntity exec = new JobExecutionEntity();
                                    exec.setJobId(current.jobId().toString());
                                    exec.setServerId(current.assignedNodeId());
                                    exec.setExitCode(-1);
                                    exec.setDurationMs(0L);
                                    exec.setStdout("");
                                    exec.setStderr("Worker node failed to acknowledge job within 30s lease.");
                                    exec.setErrorMessage("Worker node failed to acknowledge job within 30s lease.");
                                    executionRepository.save(exec);
                                } catch (Exception e) {
                                    log.error("Failed to record timeout execution for job {}: {}", current.jobId(), e.getMessage());
                                }
                            }
                        }
                        if (current.assignedNodeId() != null) {
                            nodeService.setNodeAvailable(current.assignedNodeId());
                        }
                    }
                } finally {
                    schedulingLock.unlock();
                }
            }
        }
    }
}
