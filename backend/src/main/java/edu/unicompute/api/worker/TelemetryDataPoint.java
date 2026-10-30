package edu.unicompute.api.worker;

import java.time.Instant;
import java.util.UUID;

public record TelemetryDataPoint(
        UUID jobId,
        String nodeId,
        String timestamp,
        double cpuUsagePercent,
        double memoryMb,
        int activeThreads,
        long elapsedMs
) {
    public TelemetryDataPoint {
        if (timestamp == null) {
            timestamp = Instant.now().toString();
        }
    }
}
