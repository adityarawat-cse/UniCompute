package edu.unicompute.api.jobs;

import java.time.Instant;
import java.util.UUID;

public record Job(
        UUID jobId,
        String jobName,
        String language,
        String sourceCode,
        int cpuCores,
        int memoryMb,
        int storageMb,
        int maxExecutionTimeSeconds,
        int priority,
        String schedulingAlgorithm,
        JobStatus status,
        Instant submittedAt,
        String assignedNodeId,
        String assignedNodeName,
        Instant assignedAt,
        Instant startedAt,
        Instant completedAt,
        Instant leaseExpiresAt,
        Long executionDurationMs,
        String stdout,
        String stderr,
        Integer exitCode,
        String errorMessage,
        int retryCount
) {
    public Job(
            UUID jobId,
            String jobName,
            String language,
            int cpuCores,
            int memoryMb,
            int storageMb,
            int maxExecutionTimeSeconds,
            int priority,
            String schedulingAlgorithm,
            String status,
            Instant submittedAt
    ) {
        this(
                jobId,
                jobName,
                language,
                "",
                cpuCores,
                memoryMb,
                storageMb,
                maxExecutionTimeSeconds,
                priority,
                schedulingAlgorithm,
                status != null ? JobStatus.valueOf(status.toUpperCase()) : JobStatus.QUEUED,
                submittedAt,
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
    }
    public Job withAssigned(String nodeId, String nodeName, Instant leaseExpiresAt) {
        return new Job(
                jobId, jobName, language, sourceCode, cpuCores, memoryMb, storageMb,
                maxExecutionTimeSeconds, priority, schedulingAlgorithm,
                JobStatus.ASSIGNED, submittedAt, nodeId, nodeName, Instant.now(),
                startedAt, completedAt, leaseExpiresAt, executionDurationMs,
                stdout, stderr, exitCode, errorMessage, retryCount
        );
    }

    public Job withRunning(Instant startedAt) {
        return new Job(
                jobId, jobName, language, sourceCode, cpuCores, memoryMb, storageMb,
                maxExecutionTimeSeconds, priority, schedulingAlgorithm,
                JobStatus.RUNNING, submittedAt, assignedNodeId, assignedNodeName, assignedAt,
                startedAt != null ? startedAt : Instant.now(), completedAt, leaseExpiresAt,
                executionDurationMs, stdout, stderr, exitCode, errorMessage, retryCount
        );
    }

    public Job withCompleted(long durationMs, int exitCode, String stdout, String stderr) {
        return new Job(
                jobId, jobName, language, sourceCode, cpuCores, memoryMb, storageMb,
                maxExecutionTimeSeconds, priority, schedulingAlgorithm,
                JobStatus.COMPLETED, submittedAt, assignedNodeId, assignedNodeName, assignedAt,
                startedAt, Instant.now(), null, durationMs,
                stdout, stderr, exitCode, null, retryCount
        );
    }

    public Job withFailed(long durationMs, Integer exitCode, String stdout, String stderr, String errorMsg) {
        return new Job(
                jobId, jobName, language, sourceCode, cpuCores, memoryMb, storageMb,
                maxExecutionTimeSeconds, priority, schedulingAlgorithm,
                JobStatus.FAILED, submittedAt, assignedNodeId, assignedNodeName, assignedAt,
                startedAt, Instant.now(), null, durationMs,
                stdout, stderr, exitCode, errorMsg, retryCount
        );
    }

    public Job withCancelled() {
        return new Job(
                jobId, jobName, language, sourceCode, cpuCores, memoryMb, storageMb,
                maxExecutionTimeSeconds, priority, schedulingAlgorithm,
                JobStatus.CANCELLED, submittedAt, assignedNodeId, assignedNodeName, assignedAt,
                startedAt, Instant.now(), null, executionDurationMs,
                stdout, stderr, exitCode, "Job was cancelled by user.", retryCount
        );
    }

    public Job withRetryReset() {
        return new Job(
                jobId, jobName, language, sourceCode, cpuCores, memoryMb, storageMb,
                maxExecutionTimeSeconds, priority, schedulingAlgorithm,
                JobStatus.QUEUED, submittedAt, null, null, null,
                null, null, null, null,
                null, null, null, null, retryCount + 1
        );
    }
}
