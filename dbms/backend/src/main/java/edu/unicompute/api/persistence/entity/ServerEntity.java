package edu.unicompute.api.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import edu.unicompute.api.nodes.ClusterNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA Entity mapping the MySQL 8 'servers' table.
 * Persists cluster worker nodes across backend restarts.
 */
@Entity
@Table(name = "servers")
public class ServerEntity {

    @Id
    @Column(name = "server_id", length = 64, nullable = false)
    private String serverId;

    @Column(name = "node_name", length = 100, nullable = false)
    private String nodeName;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "os", length = 100, nullable = false)
    private String os = "Linux";

    @Column(name = "total_cores", nullable = false)
    private int totalCores = 4;

    @Column(name = "total_memory_gb", nullable = false)
    private int totalMemoryGb = 8;

    @Column(name = "token", length = 128)
    private String token;

    @Column(name = "status", length = 32, nullable = false)
    private String status = "AVAILABLE";

    @Column(name = "is_online", nullable = false)
    private boolean isOnline = true;

    @Column(name = "python_available", nullable = false)
    private Boolean pythonAvailable = true;

    @Column(name = "python_version", length = 50)
    private String pythonVersion = "Python 3";

    @Column(name = "java_available", nullable = false)
    private Boolean javaAvailable = true;

    @Column(name = "java_version", length = 50)
    private String javaVersion = "Java 17";

    @Column(name = "active_job_id", length = 36)
    private String activeJobId;

    @Column(name = "last_heartbeat")
    private Instant lastHeartbeat;

    @Column(name = "registered_at", nullable = false, updatable = false)
    private Instant registeredAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public ServerEntity() {
    }

    public static ServerEntity fromDomain(ClusterNode node) {
        ServerEntity entity = new ServerEntity();
        entity.serverId = node.id();
        entity.nodeName = node.name() != null ? node.name() : node.id();
        entity.ipAddress = node.ipAddress();
        entity.os = node.os() != null ? node.os() : "Linux";
        entity.totalCores = node.cores() > 0 ? node.cores() : 4;
        entity.totalMemoryGb = node.memoryGb() > 0 ? node.memoryGb() : 8;
        entity.token = node.token();

        String rawStatus = node.status() != null ? node.status().toUpperCase() : "AVAILABLE";
        if (rawStatus.contains("BUSY")) {
            entity.status = "BUSY";
        } else if (rawStatus.contains("BREAK")) {
            entity.status = "ON_BREAK";
        } else if (rawStatus.contains("OFFLINE")) {
            entity.status = "OFFLINE";
        } else {
            entity.status = "AVAILABLE";
        }

        entity.isOnline = node.online();
        entity.pythonAvailable = node.pythonAvailable();
        entity.pythonVersion = node.pythonVersion() != null ? node.pythonVersion() : "Python 3";
        entity.javaAvailable = node.javaAvailable();
        entity.javaVersion = node.javaVersion() != null ? node.javaVersion() : "Java 17";
        entity.activeJobId = node.activeJobId() != null ? node.activeJobId().toString() : null;
        entity.lastHeartbeat = node.lastHeartbeat();
        entity.registeredAt = node.registeredAt() != null ? node.registeredAt() : Instant.now();
        entity.updatedAt = Instant.now();
        return entity;
    }

    public ClusterNode toDomain() {
        UUID activeJobUuid = null;
        if (activeJobId != null && !activeJobId.isBlank()) {
            try {
                activeJobUuid = UUID.fromString(activeJobId);
            } catch (IllegalArgumentException ignored) {
            }
        }

        String nodeStatus = "Available";
        if (status != null) {
            if ("BUSY".equalsIgnoreCase(status)) {
                nodeStatus = "Busy";
            } else if ("OFFLINE".equalsIgnoreCase(status)) {
                nodeStatus = "Offline";
            } else if ("ON_BREAK".equalsIgnoreCase(status) || "ON BREAK".equalsIgnoreCase(status)) {
                nodeStatus = "On Break";
            } else {
                nodeStatus = "Available";
            }
        }
        if ("node-3".equals(serverId)) {
            nodeStatus = "Active (Master)";
        }

        return new ClusterNode(
                serverId,
                nodeName,
                totalCores,
                totalMemoryGb,
                os != null ? os : "Linux",
                nodeStatus,
                token,
                lastHeartbeat,
                ipAddress,
                registeredAt != null ? registeredAt : Instant.now(),
                isOnline,
                activeJobUuid,
                pythonAvailable != null ? pythonAvailable : true,
                pythonVersion != null ? pythonVersion : "Python 3",
                javaAvailable != null ? javaAvailable : true,
                javaVersion != null ? javaVersion : "Java 17"
        );
    }

    // Getters and Setters
    public String getServerId() { return serverId; }
    public void setServerId(String serverId) { this.serverId = serverId; }

    public String getNodeName() { return nodeName; }
    public void setNodeName(String nodeName) { this.nodeName = nodeName; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getOs() { return os; }
    public void setOs(String os) { this.os = os; }

    public int getTotalCores() { return totalCores; }
    public void setTotalCores(int totalCores) { this.totalCores = totalCores; }

    public int getTotalMemoryGb() { return totalMemoryGb; }
    public void setTotalMemoryGb(int totalMemoryGb) { this.totalMemoryGb = totalMemoryGb; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isOnline() { return isOnline; }
    public void setIsOnline(boolean isOnline) { this.isOnline = isOnline; }

    public Boolean getPythonAvailable() { return pythonAvailable; }
    public void setPythonAvailable(Boolean pythonAvailable) { this.pythonAvailable = pythonAvailable; }

    public String getPythonVersion() { return pythonVersion; }
    public void setPythonVersion(String pythonVersion) { this.pythonVersion = pythonVersion; }

    public Boolean getJavaAvailable() { return javaAvailable; }
    public void setJavaAvailable(Boolean javaAvailable) { this.javaAvailable = javaAvailable; }

    public String getJavaVersion() { return javaVersion; }
    public void setJavaVersion(String javaVersion) { this.javaVersion = javaVersion; }

    public String getActiveJobId() { return activeJobId; }
    public void setActiveJobId(String activeJobId) { this.activeJobId = activeJobId; }

    public Instant getLastHeartbeat() { return lastHeartbeat; }
    public void setLastHeartbeat(Instant lastHeartbeat) { this.lastHeartbeat = lastHeartbeat; }

    public Instant getRegisteredAt() { return registeredAt; }
    public void setRegisteredAt(Instant registeredAt) { this.registeredAt = registeredAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}

