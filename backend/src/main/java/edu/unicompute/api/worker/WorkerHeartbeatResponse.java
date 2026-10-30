package edu.unicompute.api.worker;

import java.util.UUID;

public record WorkerHeartbeatResponse(
        String status,
        String command,
        UUID targetJobId
) {
    public static WorkerHeartbeatResponse none(String status) {
        return new WorkerHeartbeatResponse(status, "NONE", null);
    }

    public static WorkerHeartbeatResponse cancel(String status, UUID jobId) {
        return new WorkerHeartbeatResponse(status, "CANCEL_JOB", jobId);
    }

    public static WorkerHeartbeatResponse pause(String status, UUID jobId) {
        return new WorkerHeartbeatResponse(status, "PAUSE_JOB", jobId);
    }

    public static WorkerHeartbeatResponse resume(String status, UUID jobId) {
        return new WorkerHeartbeatResponse(status, "RESUME_JOB", jobId);
    }
}
