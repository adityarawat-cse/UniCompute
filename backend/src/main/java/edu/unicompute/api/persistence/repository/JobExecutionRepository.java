package edu.unicompute.api.persistence.repository;

import java.util.List;
import java.util.Optional;

import edu.unicompute.api.persistence.entity.JobExecutionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA Repository for job execution logs, outputs, and exit codes.
 */
@Repository
public interface JobExecutionRepository extends JpaRepository<JobExecutionEntity, Long> {

    /**
     * Retrieves the latest execution log for a specific job.
     */
    Optional<JobExecutionEntity> findTopByJobIdOrderByExecutedAtDesc(String jobId);

    /**
     * Retrieves all historical executions for a specific job.
     */
    List<JobExecutionEntity> findByJobIdOrderByExecutedAtDesc(String jobId);
}
