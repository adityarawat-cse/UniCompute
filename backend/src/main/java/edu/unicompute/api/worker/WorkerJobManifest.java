package edu.unicompute.api.worker;

import java.util.UUID;

public record WorkerJobManifest(
        UUID jobId,
        String jobName,
        String language,
        String sourceCode,
        int cpuCores,
        int memoryMb,
        int maxExecutionTimeSeconds
) {
}
