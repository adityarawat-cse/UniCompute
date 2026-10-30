package edu.unicompute.api.worker;

import java.util.UUID;

public record WorkerTelemetryRequest(
        UUID jobId,
        double cpuUsagePercent,
        double memoryMb,
        int activeThreads,
        long elapsedMs
) {}
