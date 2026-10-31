package edu.unicompute.api.persistence.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA Entity mapping the MySQL 8 'job_executions' table.
 */
@Entity
@Table(name = "job_executions")
public class JobExecutionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "execution_id")
    private Long executionId;

    @Column(name = "job_id", length = 36, nullable = false)
    private String jobId;

    @Column(name = "server_id", length = 64)
    private String serverId;

    @Column(name = "exit_code")
    private Integer exitCode;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "stdout", columnDefinition = "LONGTEXT")
    private String stdout;

    @Column(name = "stderr", columnDefinition = "LONGTEXT")
    private String stderr;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "executed_at", nullable = false, updatable = false)
    private Instant executedAt = Instant.now();

    public JobExecutionEntity() {}

    public Long getExecutionId() { return executionId; }
    public void setExecutionId(Long executionId) { this.executionId = executionId; }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getServerId() { return serverId; }
    public void setServerId(String serverId) { this.serverId = serverId; }

    public Integer getExitCode() { return exitCode; }
    public void setExitCode(Integer exitCode) { this.exitCode = exitCode; }

    public Long getDurationMs() { return durationMs; }
    public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }

    public String getStdout() { return stdout; }
    public void setStdout(String stdout) { this.stdout = stdout; }

    public String getStderr() { return stderr; }
    public void setStderr(String stderr) { this.stderr = stderr; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Instant getExecutedAt() { return executedAt; }
    public void setExecutedAt(Instant executedAt) { this.executedAt = executedAt; }
}
