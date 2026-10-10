package edu.unicompute.api.jobs;

import java.time.Instant;
import java.util.UUID;

public record Job(
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
}
