package edu.unicompute.api.nodes;

import java.time.Instant;
import java.util.UUID;

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
        boolean online,
        UUID activeJobId,
        boolean pythonAvailable,
        String pythonVersion,
        boolean javaAvailable,
        String javaVersion
) {
    public ClusterNode(
            String id, String name, int cores, int memoryGb, String os,
            String status, String token, Instant lastHeartbeat,
            String ipAddress, Instant registeredAt, boolean online) {
        this(id, name, cores, memoryGb, os, status, token, lastHeartbeat, ipAddress, registeredAt, online, null, true, "Python 3", true, "Java 17");
    }

    public ClusterNode(
            String id, String name, int cores, int memoryGb, String os,
            String status, String token, Instant lastHeartbeat,
            String ipAddress, Instant registeredAt, boolean online,
            UUID activeJobId, boolean pythonAvailable, String pythonVersion) {
        this(id, name, cores, memoryGb, os, status, token, lastHeartbeat, ipAddress, registeredAt, online, activeJobId, pythonAvailable, pythonVersion, true, "Java 17");
    }

    public ClusterNode withStatus(String newStatus, boolean newOnline) {
        return new ClusterNode(
                id, name, cores, memoryGb, os, newStatus, token,
                lastHeartbeat, ipAddress, registeredAt, newOnline,
                "Available".equalsIgnoreCase(newStatus) ? null : activeJobId,
                pythonAvailable, pythonVersion, javaAvailable, javaVersion
        );
    }

    public ClusterNode withActiveJob(UUID jobId) {
        return new ClusterNode(
                id, name, cores, memoryGb, os, "Busy", token,
                lastHeartbeat, ipAddress, registeredAt, true,
                jobId, pythonAvailable, pythonVersion, javaAvailable, javaVersion
        );
    }

    public ClusterNode withJobCleared() {
        return new ClusterNode(
                id, name, cores, memoryGb, os, "Available", token,
                lastHeartbeat, ipAddress, registeredAt, true,
                null, pythonAvailable, pythonVersion, javaAvailable, javaVersion
        );
    }

    public ClusterNode withHeartbeat(
            Instant heartbeatTime, String newIp, String reportedOs,
            Integer reportedCores, Integer reportedMemoryGb,
            UUID reportedActiveJobId, Boolean reportedPythonAvailable, String reportedPythonVersion,
            Boolean reportedJavaAvailable, String reportedJavaVersion) {

        String currentStatus;
        if ("On Break".equalsIgnoreCase(status)) {
            currentStatus = "On Break";
        } else if (activeJobId != null || reportedActiveJobId != null) {
            currentStatus = "Busy";
        } else {
            currentStatus = "Available";
        }

        UUID jobToKeep = reportedActiveJobId != null ? reportedActiveJobId : activeJobId;

        return new ClusterNode(
                id,
                name,
                reportedCores != null && reportedCores > 0 ? reportedCores : cores,
                reportedMemoryGb != null && reportedMemoryGb > 0 ? reportedMemoryGb : memoryGb,
                reportedOs != null && !reportedOs.isBlank() ? reportedOs : os,
                currentStatus,
                token,
                heartbeatTime,
                newIp != null ? newIp : ipAddress,
                registeredAt,
                true,
                jobToKeep,
                reportedPythonAvailable != null ? reportedPythonAvailable : pythonAvailable,
                reportedPythonVersion != null ? reportedPythonVersion : pythonVersion,
                reportedJavaAvailable != null ? reportedJavaAvailable : javaAvailable,
                reportedJavaVersion != null ? reportedJavaVersion : javaVersion
        );
    }

    public ClusterNode withHeartbeat(
            Instant heartbeatTime, String newIp, String reportedOs,
            Integer reportedCores, Integer reportedMemoryGb,
            UUID reportedActiveJobId, Boolean reportedPythonAvailable, String reportedPythonVersion) {
        return withHeartbeat(heartbeatTime, newIp, reportedOs, reportedCores, reportedMemoryGb, reportedActiveJobId, reportedPythonAvailable, reportedPythonVersion, javaAvailable, javaVersion);
    }
}
