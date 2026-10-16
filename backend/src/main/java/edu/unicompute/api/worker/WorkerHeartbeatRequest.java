package edu.unicompute.api.worker;

import java.util.UUID;

public record WorkerHeartbeatRequest(
        UUID activeJobId,
        Boolean pythonAvailable,
        String pythonVersion,
        Boolean javaAvailable,
        String javaVersion
) {
    public WorkerHeartbeatRequest(UUID activeJobId, Boolean pythonAvailable, String pythonVersion) {
        this(activeJobId, pythonAvailable, pythonVersion, true, "Java 17");
    }
}
