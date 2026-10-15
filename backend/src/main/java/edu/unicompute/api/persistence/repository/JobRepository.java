package edu.unicompute.api.persistence.repository;

import java.util.List;

import edu.unicompute.api.jobs.JobStatus;
import edu.unicompute.api.persistence.entity.JobEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA Repository for managing durable computing jobs in MySQL 8.
 */
@Repository
public interface JobRepository extends JpaRepository<JobEntity, String> {

    /**
     * Retrieves all jobs in a given status ordered by priority (highest first),
     * followed by earliest submission time (FIFO within same priority).
     */
    List<JobEntity> findByStatusOrderByPriorityDescSubmittedAtAsc(JobStatus status);

    /**
     * Retrieves active jobs assigned to a particular worker server.
     */
    List<JobEntity> findByAssignedServerIdAndStatus(String assignedServerId, JobStatus status);

    /**
     * Retrieves all jobs submitted by a specific user.
     */
    List<JobEntity> findByUserId(Long userId);

    /**
     * Retrieves all jobs under a specific project.
     */
    List<JobEntity> findByProjectId(Long projectId);
}
