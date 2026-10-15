package edu.unicompute.api.worker;

import java.util.UUID;

public record WorkerHeartbeatRequest(
        UUID activeJobId,
        Boolean pythonAvailable,
        String pythonVersion
) {
}
