package edu.unicompute.api.jobs;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.stereotype.Service;

import edu.unicompute.api.nodes.ClusterNode;
import edu.unicompute.api.nodes.NodeService;
import edu.unicompute.api.worker.WorkerJobManifest;
import edu.unicompute.api.worker.WorkerResultRequest;

@Service
public class JobService {

    private final Map<UUID, Job> jobs = new ConcurrentHashMap<>();
    private final NodeService nodeService;
    private final ReentrantLock schedulingLock = new ReentrantLock();

    public JobService(NodeService nodeService) {
        this.nodeService = nodeService;
    }

    public Job submit(JobSubmissionRequest request) {
        UUID jobId = UUID.randomUUID();

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
                0
        );

        jobs.put(jobId, job);
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
                        } else {
                            Job failed = current.withFailed(0, -1, "", "", "Worker node failed to acknowledge job within 30s lease.");
                            jobs.put(failed.jobId(), failed);
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