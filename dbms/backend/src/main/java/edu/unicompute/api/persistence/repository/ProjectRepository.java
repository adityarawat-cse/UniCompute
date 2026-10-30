package edu.unicompute.api.persistence.repository;

import java.util.List;
import java.util.Optional;

import edu.unicompute.api.persistence.entity.ProjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA Repository for university academic & research projects.
 */
@Repository
public interface ProjectRepository extends JpaRepository<ProjectEntity, Long> {

    Optional<ProjectEntity> findByProjectCode(String projectCode);

    List<ProjectEntity> findByOwnerUserId(Long ownerUserId);

    boolean existsByProjectCode(String projectCode);
}
