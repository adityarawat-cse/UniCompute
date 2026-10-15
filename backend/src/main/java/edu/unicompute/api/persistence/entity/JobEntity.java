package edu.unicompute.api.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import edu.unicompute.api.jobs.Job;
import edu.unicompute.api.jobs.JobStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA Entity mapping the durable MySQL 8 'jobs' table.
 * Designed to seamlessly bridge with the Java record 'Job'.
 */
@Entity
@Table(name = "jobs")
public class JobEntity {

    @Id
    @Column(name = "job_id", length = 36, nullable = false)
    private String jobId;

    @Column(name = "job_name", length = 150, nullable = false)
    private String jobName;

    @Column(name = "language", length = 32, nullable = false)
    private String language;

    @Column(name = "source_code", columnDefinition = "LONGTEXT", nullable = false)
    private String sourceCode;

    @Column(name = "cpu_cores", nullable = false)
    private int cpuCores;

    @Column(name = "memory_mb", nullable = false)
    private int memoryMb;

    @Column(name = "storage_mb", nullable = false)
    private int storageMb;

    @Column(name = "max_execution_time_seconds", nullable = false)
    private int maxExecutionTimeSeconds;

    @Column(name = "priority", nullable = false)
    private int priority;

    @Column(name = "scheduling_algorithm", length = 50, nullable = false)
    private String schedulingAlgorithm;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private JobStatus status;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "assigned_server_id", length = 64)
    private String assignedServerId;

    @Column(name = "assigned_node_name", length = 100)
    private String assignedNodeName;

    @Column(name = "retry_count", nullable = false)
    private int retryCount;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "assigned_at")
    private Instant assignedAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "lease_expires_at")
    private Instant leaseExpiresAt;

    public JobEntity() {
    }

    public static JobEntity fromDomain(Job job) {
        JobEntity entity = new JobEntity();
        entity.jobId = job.jobId() != null ? job.jobId().toString() : UUID.randomUUID().toString();
        entity.jobName = job.jobName();
        entity.language = job.language();
        entity.sourceCode = job.sourceCode();
        entity.cpuCores = job.cpuCores();
        entity.memoryMb = job.memoryMb();
        entity.storageMb = job.storageMb();
        entity.maxExecutionTimeSeconds = job.maxExecutionTimeSeconds();
        entity.priority = job.priority();
        entity.schedulingAlgorithm = job.schedulingAlgorithm();
        entity.status = job.status() != null ? job.status() : JobStatus.QUEUED;
        entity.assignedServerId = job.assignedNodeId();
        entity.assignedNodeName = job.assignedNodeName();
        entity.retryCount = job.retryCount();
        entity.submittedAt = job.submittedAt() != null ? job.submittedAt() : Instant.now();
        entity.assignedAt = job.assignedAt();
        entity.startedAt = job.startedAt();
        entity.completedAt = job.completedAt();
        entity.leaseExpiresAt = job.leaseExpiresAt();
        return entity;
    }

    public Job toDomain(Long durationMs, String stdout, String stderr, Integer exitCode, String errorMessage) {
        return new Job(
                UUID.fromString(jobId),
                jobName,
                language,
                sourceCode,
                cpuCores,
                memoryMb,
                storageMb,
                maxExecutionTimeSeconds,
                priority,
                schedulingAlgorithm,
                status,
                submittedAt,
                assignedServerId,
                assignedNodeName,
                assignedAt,
                startedAt,
                completedAt,
                leaseExpiresAt,
                durationMs,
                stdout,
                stderr,
                exitCode,
                errorMessage,
                retryCount
        );
    }

    // Getters and Setters
    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getJobName() { return jobName; }
    public void setJobName(String jobName) { this.jobName = jobName; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getSourceCode() { return sourceCode; }
    public void setSourceCode(String sourceCode) { this.sourceCode = sourceCode; }

    public int getCpuCores() { return cpuCores; }
    public void setCpuCores(int cpuCores) { this.cpuCores = cpuCores; }

    public int getMemoryMb() { return memoryMb; }
    public void setMemoryMb(int memoryMb) { this.memoryMb = memoryMb; }

    public int getStorageMb() { return storageMb; }
    public void setStorageMb(int storageMb) { this.storageMb = storageMb; }

    public int getMaxExecutionTimeSeconds() { return maxExecutionTimeSeconds; }
    public void setMaxExecutionTimeSeconds(int maxExecutionTimeSeconds) { this.maxExecutionTimeSeconds = maxExecutionTimeSeconds; }

    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }

    public String getSchedulingAlgorithm() { return schedulingAlgorithm; }
    public void setSchedulingAlgorithm(String schedulingAlgorithm) { this.schedulingAlgorithm = schedulingAlgorithm; }

    public JobStatus getStatus() { return status; }
    public void setStatus(JobStatus status) { this.status = status; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public String getAssignedServerId() { return assignedServerId; }
    public void setAssignedServerId(String assignedServerId) { this.assignedServerId = assignedServerId; }

    public String getAssignedNodeName() { return assignedNodeName; }
    public void setAssignedNodeName(String assignedNodeName) { this.assignedNodeName = assignedNodeName; }

    public int getRetryCount() { return retryCount; }
    public void setRetryCount(int retryCount) { this.retryCount = retryCount; }

    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }

    public Instant getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Instant assignedAt) { this.assignedAt = assignedAt; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public Instant getLeaseExpiresAt() { return leaseExpiresAt; }
    public void setLeaseExpiresAt(Instant leaseExpiresAt) { this.leaseExpiresAt = leaseExpiresAt; }
}
