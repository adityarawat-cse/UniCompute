package edu.unicompute.api.nodes;

import java.time.Instant;

public record ClusterNode(
        String id,
        String name,
        int cores,
        int memoryGb,
        String os,
        String status,
        String token,
        Instant lastHeartbeat,
        String ipAddress,
        Instant registeredAt,
        boolean online
) {
    public ClusterNode withStatus(String newStatus, boolean newOnline) {
        return new ClusterNode(
                id,
                name,
                cores,
                memoryGb,
                os,
                newStatus,
                token,
                lastHeartbeat,
                ipAddress,
                registeredAt,
                newOnline
        );
    }

    public ClusterNode withHeartbeat(Instant heartbeatTime, String newIp, String reportedOs, Integer reportedCores, Integer reportedMemoryGb) {
        return new ClusterNode(
                id,
                name,
                reportedCores != null && reportedCores > 0 ? reportedCores : cores,
                reportedMemoryGb != null && reportedMemoryGb > 0 ? reportedMemoryGb : memoryGb,
                reportedOs != null && !reportedOs.isBlank() ? reportedOs : os,
                "On Break".equalsIgnoreCase(status) ? "On Break" : "Available",
                token,
                heartbeatTime,
                newIp != null ? newIp : ipAddress,
                registeredAt,
                true
        );
    }
}
