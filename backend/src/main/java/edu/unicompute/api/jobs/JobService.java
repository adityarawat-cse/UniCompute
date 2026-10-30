package edu.unicompute.api.jobs;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
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
import edu.unicompute.api.worker.TelemetryDataPoint;
import edu.unicompute.api.worker.WorkerJobManifest;
import edu.unicompute.api.worker.WorkerResultRequest;
import edu.unicompute.api.worker.WorkerTelemetryRequest;

@Service
public class JobService {

    private static final Logger log = LoggerFactory.getLogger(JobService.class);

    private final Map<UUID, Job> jobs = new ConcurrentHashMap<>();
    private final Map<UUID, List<TelemetryDataPoint>> telemetryStore = new ConcurrentHashMap<>();
    private final Map<String, List<UUID>> suspendedJobsByNode = new ConcurrentHashMap<>();
    private final Map<String, UUID> pendingResumes = new ConcurrentHashMap<>();
    private final NodeService nodeService;
    private final JobRepository jobRepository;
    private final JobExecutionRepository executionRepository;
    private final UserService userService;
    private final edu.unicompute.api.uploads.UploadService uploadService;
    private final ReentrantLock schedulingLock = new ReentrantLock();

    @Autowired
    public JobService(
            NodeService nodeService,
            @Autowired(required = false) JobRepository jobRepository,
            @Autowired(required = false) JobExecutionRepository executionRepository,
            @Autowired(required = false) UserService userService,
            @Autowired(required = false) edu.unicompute.api.uploads.UploadService uploadService) {
        this.nodeService = nodeService;
        this.jobRepository = jobRepository;
        this.executionRepository = executionRepository;
        this.userService = userService;
        this.uploadService = uploadService;
        initFromDatabase();
    }

    public JobService(
            NodeService nodeService,
            JobRepository jobRepository,
            JobExecutionRepository executionRepository,
            UserService userService) {
        this(nodeService, jobRepository, executionRepository, userService, null);
    }

    public JobService(NodeService nodeService) {
        this(nodeService, null, null, null, null);
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

    // B-4: Smart Heuristic AI Runtime Predictor & Policy Selector
    public AiPredictionResult predictRuntimeAndPolicy(JobSubmissionRequest request) {
        String code = request.sourceCode() != null ? request.sourceCode() : "";
        if (code.startsWith("pkg:") && uploadService != null) {
            String fileId = code.substring(4).trim();
            code = uploadService.getAssembledFileDataUrl(fileId).orElse(code);
        }

        String[] lines = code.split("\r?\n");
        int lineCount = Math.max(1, lines.length);

        String[] tokens = code.split("\\s+");
        int tokenCount = Math.max(1, tokens.length);

        int loopCount = countOccurrences(code, "for ") + countOccurrences(code, "while ") + countOccurrences(code, "forEach");
        int computeImports = countOccurrences(code, "numpy") + countOccurrences(code, "torch")
                + countOccurrences(code, "scipy") + countOccurrences(code, "matrix")
                + countOccurrences(code, "Thread") + countOccurrences(code, "ExecutorService");

        double complexityScore = (lineCount * 0.05) + (loopCount * 0.8) + (computeImports * 1.5);

        boolean isJava = "JAVA".equalsIgnoreCase(request.language());
        int cores = Math.max(1, request.cpuCores());
        int maxAllowedSec = Math.max(5, request.maxExecutionTimeSeconds());

        double baseDuration = (12.0 * Math.max(0.4, Math.min(3.5, complexityScore))) / Math.max(1.0, cores * 0.75);
        if (isJava) {
            baseDuration *= 0.85;
        }

        List<Job> pastJobs = jobs.values().stream()
                .filter(j -> j.status() == JobStatus.COMPLETED && j.executionDurationMs() != null)
                .filter(j -> request.userId() != null && request.userId().equals(j.userId()))
                .filter(j -> request.language().equalsIgnoreCase(j.language()))
                .toList();

        double finalPredictedSec;
        String historyNote;
        if (!pastJobs.isEmpty()) {
            double avgHistoricalSec = pastJobs.stream()
                    .mapToLong(Job::executionDurationMs)
                    .average()
                    .orElse(10000L) / 1000.0;
            finalPredictedSec = (avgHistoricalSec * 0.6) + (baseDuration * 0.4);
            historyNote = String.format("calibrated with %d past user runs (avg: %.1fs)", pastJobs.size(), avgHistoricalSec);
        } else {
            finalPredictedSec = baseDuration;
            historyNote = "derived from heuristic token complexity and core scaling";
        }

        int predictedSec = (int) Math.min(maxAllowedSec, Math.max(2, Math.round(finalPredictedSec)));

        String optimalAlgo;
        String reasoning;

        if (request.priority() == 3) {
            optimalAlgo = "PRIORITY";
            reasoning = "High Priority (Preemptive Urgent): Fast-track execution ahead of batch workloads.";
        } else if (predictedSec <= 15) {
            optimalAlgo = "SJF";
            reasoning = String.format("Shortest Job First: Fast task (~%ds) prioritized to minimize queue latency (%s).", predictedSec, historyNote);
        } else {
            optimalAlgo = "ROUND_ROBIN";
            reasoning = String.format("Standard Workload (~%ds): Fair cluster distribution with quantum leasing (%s).", predictedSec, historyNote);
        }

        return new AiPredictionResult(
                predictedSec,
                optimalAlgo,
                reasoning,
                lineCount,
                tokenCount,
                Math.round(complexityScore * 100.0) / 100.0
        );
    }

    private int countOccurrences(String text, String target) {
        if (text == null || target == null || text.isEmpty() || target.isEmpty()) return 0;
        int count = 0;
        int idx = 0;
        while ((idx = text.indexOf(target, idx)) != -1) {
            count++;
            idx += target.length();
        }
        return count;
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

        String resolvedSourceCode = request.sourceCode();
        if (resolvedSourceCode != null && resolvedSourceCode.startsWith("pkg:") && uploadService != null) {
            String fileId = resolvedSourceCode.substring(4).trim();
            resolvedSourceCode = uploadService.getAssembledFileDataUrl(fileId).orElse(resolvedSourceCode);
        }

        String resolvedAlgo = request.schedulingAlgorithm();
        AiPredictionResult prediction = predictRuntimeAndPolicy(request);
        if (resolvedAlgo == null || resolvedAlgo.isBlank() || "AUTO".equalsIgnoreCase(resolvedAlgo)) {
            resolvedAlgo = prediction.optimalAlgorithm();
            log.info("B-4 AI Scheduler: Job '{}' assigned optimal policy {} (predicted ~{}s, {})",
                    request.jobName(), resolvedAlgo, prediction.predictedDurationSeconds(), prediction.reasoning());
        }

        Job job = new Job(
                jobId,
                request.jobName(),
                request.language().toUpperCase(),
                resolvedSourceCode,
                request.cpuCores(),
                request.memoryMb(),
                request.storageMb(),
                request.maxExecutionTimeSeconds(),
                request.priority(),
                resolvedAlgo,
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

        // B-2: Check if this high-priority job should preempt a running lower-priority job
        if (job.priority() == 3) {
            checkForPreemption();
        }

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
            checkForPreemption();

            // Check if node is online and ready (or is hosting a suspended job waiting for preemption execution)
            boolean nodeReady = workerNode.online() &&
                    ("Available".equalsIgnoreCase(workerNode.status()) ||
                     (workerNode.activeJobId() != null && jobs.containsKey(workerNode.activeJobId()) && jobs.get(workerNode.activeJobId()).status() == JobStatus.SUSPENDED));

            if (!nodeReady) {
                return Optional.empty();
            }

            // B-4 AI Policy-aware comparator: Priority (3 > 2 > 1), then SJF for fast tasks, then FCFS
            Comparator<Job> schedulingComparator = (j1, j2) -> {
                int pCompare = Integer.compare(j2.priority(), j1.priority());
                if (pCompare != 0) return pCompare;

                boolean j1IsSjf = "SJF".equalsIgnoreCase(j1.schedulingAlgorithm());
                boolean j2IsSjf = "SJF".equalsIgnoreCase(j2.schedulingAlgorithm());

                if (j1IsSjf && j2IsSjf) {
                    int durationCompare = Integer.compare(j1.maxExecutionTimeSeconds(), j2.maxExecutionTimeSeconds());
                    if (durationCompare != 0) return durationCompare;
                } else if (j1IsSjf && !j2IsSjf) {
                    return -1;
                } else if (!j1IsSjf && j2IsSjf) {
                    return 1;
                }

                return j1.submittedAt().compareTo(j2.submittedAt());
            };

            // Find first matching QUEUED job based on priority and submission time
            Optional<Job> candidate = jobs.values().stream()
                    .filter(j -> j.status() == JobStatus.QUEUED)
                    .filter(j -> !("PYTHON".equalsIgnoreCase(j.language()) && !workerNode.pythonAvailable()))
                    .filter(j -> !("JAVA".equalsIgnoreCase(j.language()) && !workerNode.javaAvailable()))
                    .filter(j -> j.cpuCores() <= availableCores && j.cpuCores() <= workerNode.cores())
                    .filter(j -> j.memoryMb() <= availableMemoryMb && (j.memoryMb() <= workerNode.memoryGb() * 1024L))
                    .min(schedulingComparator);

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

            // B-2: Check if there was a suspended job on this node that can now be resumed!
            List<UUID> suspendedList = suspendedJobsByNode.get(nodeId);
            if (suspendedList != null && !suspendedList.isEmpty()) {
                UUID jobToResumeId = suspendedList.remove(suspendedList.size() - 1);
                Job suspended = jobs.get(jobToResumeId);
                if (suspended != null && suspended.status() == JobStatus.SUSPENDED) {
                    Job resumed = suspended.withResumed();
                    jobs.put(resumed.jobId(), resumed);
                    persistJob(resumed);
                    pendingResumes.put(nodeId, jobToResumeId);
                    log.info("B-2 RESUME: Resuming previously suspended job {} on node {} after high-priority completion",
                            jobToResumeId, nodeId);
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

    public void cleanupUserWorkloads(Long userId) {
        if (userId == null) return;
        for (Job job : jobs.values()) {
            if (userId.equals(job.userId())) {
                if (job.status() == JobStatus.QUEUED || job.status() == JobStatus.RUNNING
                        || job.status() == JobStatus.SUSPENDED || job.status() == JobStatus.ASSIGNED) {
                    cancelJob(job.jobId());
                    log.info("B-7 Delete User: Cancelled active job {} for deleted user {}", job.jobId(), userId);
                }
            }
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

    // B-8: Synchronized Per-Process Telemetry Stream
    public void recordTelemetry(UUID jobId, String nodeId, WorkerTelemetryRequest req) {
        if (jobId == null || req == null) return;
        TelemetryDataPoint point = new TelemetryDataPoint(
                jobId,
                nodeId,
                Instant.now().toString(),
                req.cpuUsagePercent(),
                req.memoryMb(),
                req.activeThreads() > 0 ? req.activeThreads() : 1,
                req.elapsedMs()
        );
        telemetryStore.computeIfAbsent(jobId, k -> new CopyOnWriteArrayList<>()).add(point);
        List<TelemetryDataPoint> list = telemetryStore.get(jobId);
        if (list.size() > 100) {
            list.remove(0);
        }
    }

    public List<TelemetryDataPoint> getTelemetry(UUID jobId) {
        if (jobId == null) return List.of();
        return telemetryStore.getOrDefault(jobId, List.of());
    }

    // B-2: Process Preemption Engine
    public void checkForPreemption() {
        schedulingLock.lock();
        try {
            // Find queued jobs with priority = 3 (HIGH)
            List<Job> urgentJobs = jobs.values().stream()
                    .filter(j -> j.status() == JobStatus.QUEUED && j.priority() == 3)
                    .sorted(Comparator.comparing(Job::submittedAt))
                    .toList();

            for (Job urgentJob : urgentJobs) {
                // Can any currently available online node execute this urgent job?
                boolean canRunOnIdleNode = nodeService.findAll().stream()
                        .filter(n -> n.online() && "Available".equalsIgnoreCase(n.status()) && n.activeJobId() == null)
                        .filter(n -> !("PYTHON".equalsIgnoreCase(urgentJob.language()) && !n.pythonAvailable()))
                        .filter(n -> !("JAVA".equalsIgnoreCase(urgentJob.language()) && !n.javaAvailable()))
                        .anyMatch(n -> urgentJob.cpuCores() <= n.cores() && (urgentJob.memoryMb() <= n.memoryGb() * 1024L));

                if (canRunOnIdleNode) {
                    continue; // An idle node exists that can run this urgent job; no preemption needed
                }

                // No idle node can run this urgent job.
                // Find a busy node running a LOWER priority job (priority < 3) that CAN fit this urgent job:
                Optional<Job> candidateVictim = jobs.values().stream()
                        .filter(j -> j.status() == JobStatus.RUNNING && j.priority() < urgentJob.priority())
                        .filter(j -> {
                            if (j.assignedNodeId() == null) return false;
                            Optional<ClusterNode> nOpt = nodeService.findById(j.assignedNodeId());
                            if (nOpt.isEmpty() || !nOpt.get().online()) return false;
                            ClusterNode n = nOpt.get();
                            return urgentJob.cpuCores() <= n.cores() && (urgentJob.memoryMb() <= n.memoryGb() * 1024L);
                        })
                        .min(Comparator.comparingInt(Job::priority).thenComparing(Job::submittedAt));

                if (candidateVictim.isPresent()) {
                    Job victim = candidateVictim.get();
                    String targetNodeId = victim.assignedNodeId();

                    log.warn("B-2 PREEMPTION: High-priority job {} preempts running job {} on node {}",
                            urgentJob.jobId(), victim.jobId(), targetNodeId);

                    Job suspendedVictim = victim.withSuspended();
                    jobs.put(victim.jobId(), suspendedVictim);
                    persistJob(suspendedVictim);

                    if (targetNodeId != null) {
                        suspendedJobsByNode.computeIfAbsent(targetNodeId, k -> new CopyOnWriteArrayList<>()).add(victim.jobId());
                        nodeService.setNodeAvailable(targetNodeId);
                    }
                }
            }
        } finally {
            schedulingLock.unlock();
        }
    }

    public UUID checkPendingResume(String nodeId) {
        if (nodeId == null) return null;
        return pendingResumes.remove(nodeId);
    }

    public List<UUID> getSuspendedJobs(String nodeId) {
        if (nodeId == null) return List.of();
        return suspendedJobsByNode.getOrDefault(nodeId, List.of());
    }

    public void clearAllJobs() {
        jobs.clear();
        telemetryStore.clear();
        suspendedJobsByNode.clear();
        pendingResumes.clear();
    }
}
