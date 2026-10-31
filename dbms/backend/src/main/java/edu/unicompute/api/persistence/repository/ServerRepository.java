package edu.unicompute.api.persistence.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import edu.unicompute.api.persistence.entity.ServerEntity;

@Repository
public interface ServerRepository extends JpaRepository<ServerEntity, String> {
    Optional<ServerEntity> findByToken(String token);
}
