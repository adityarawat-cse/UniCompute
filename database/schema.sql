-- =============================================================================
-- UniCompute Distributed Campus Cloud Computing Platform
-- Database Schema: MySQL 8+
-- Target: Relational durability for User accounts, Projects, Job queue, 
--         Worker servers, Resource tracking, Allocations, Executions & Quotas.
-- Note: Live real-time node telemetry is synchronized via gossip / heartbeat.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `unicompute_db`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `unicompute_db`;

-- -----------------------------------------------------------------------------
-- Clean teardown (safe reverse dependency order)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `reservations`;
DROP TABLE IF EXISTS `job_executions`;
DROP TABLE IF EXISTS `job_allocations`;
DROP TABLE IF EXISTS `quotas`;
DROP TABLE IF EXISTS `jobs`;
DROP TABLE IF EXISTS `server_resources`;
DROP TABLE IF EXISTS `servers`;
DROP TABLE IF EXISTS `projects`;
DROP TABLE IF EXISTS `users`;

-- -----------------------------------------------------------------------------
-- 1. USER: User Accounts, Roles, and Authentication metadata
-- -----------------------------------------------------------------------------
CREATE TABLE `users` (
    `user_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(64) NOT NULL UNIQUE,
    `email` VARCHAR(128) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(128) NOT NULL,
    `role` ENUM('ADMIN', 'RESEARCHER', 'STUDENT', 'GUEST') NOT NULL DEFAULT 'STUDENT',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
    `department` VARCHAR(100) NULL,
    `daily_quota_seconds` INT NOT NULL DEFAULT 3600 COMMENT 'Daily runtime allowance in seconds',
    `used_quota_seconds` INT NOT NULL DEFAULT 0 COMMENT 'Total runtime consumed today',
    `quota_reset_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when quota resets (24h rolling)',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_role` (`role`),
    INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. PROJECT: University Academic & Research Projects
-- -----------------------------------------------------------------------------
CREATE TABLE `projects` (
    `project_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `project_code` VARCHAR(32) NOT NULL UNIQUE,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `owner_user_id` BIGINT NOT NULL,
    `department` VARCHAR(100) NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_projects_owner`
        FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_projects_owner` (`owner_user_id`),
    INDEX `idx_projects_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. SERVER: Cluster Worker Nodes (Coordinates with ClusterNode in Spring Boot)
-- -----------------------------------------------------------------------------
CREATE TABLE `servers` (
    `server_id` VARCHAR(64) PRIMARY KEY COMMENT 'Matches backend node ID, e.g. uc-node-xxx',
    `node_name` VARCHAR(100) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `os` VARCHAR(100) NOT NULL DEFAULT 'Linux',
    `total_cores` INT NOT NULL DEFAULT 4,
    `total_memory_gb` INT NOT NULL DEFAULT 8,
    `token` VARCHAR(128) NULL,
    `status` ENUM('AVAILABLE', 'BUSY', 'OFFLINE', 'ON_BREAK') NOT NULL DEFAULT 'AVAILABLE',
    `is_online` BOOLEAN NOT NULL DEFAULT TRUE,
    `python_available` BOOLEAN NOT NULL DEFAULT TRUE,
    `python_version` VARCHAR(50) NULL DEFAULT 'Python 3',
    `java_available` BOOLEAN NOT NULL DEFAULT TRUE,
    `java_version` VARCHAR(50) NULL DEFAULT 'Java 17',
    `active_job_id` VARCHAR(36) NULL COMMENT 'UUID of current active job if running',
    `last_heartbeat` TIMESTAMP NULL,
    `registered_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_servers_status_online` (`status`, `is_online`),
    INDEX `idx_servers_last_heartbeat` (`last_heartbeat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. RESOURCE: Detailed Hardware Specifications per Worker Server
-- -----------------------------------------------------------------------------
CREATE TABLE `server_resources` (
    `resource_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `server_id` VARCHAR(64) NOT NULL UNIQUE,
    `cpu_model` VARCHAR(120) NULL,
    `cpu_clock_ghz` DECIMAL(4, 2) NULL,
    `cpu_cores` INT NOT NULL,
    `total_ram_mb` INT NOT NULL,
    `available_ram_mb` INT NOT NULL,
    `storage_mb` BIGINT NOT NULL DEFAULT 102400,
    `available_storage_mb` BIGINT NOT NULL DEFAULT 102400,
    `gpu_model` VARCHAR(100) NULL,
    `gpu_count` INT NOT NULL DEFAULT 0,
    `last_checked_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_server_resources_server`
        FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. JOB: Distributed Computing Job Queue (Coordinated with Job record in Spring Boot)
-- -----------------------------------------------------------------------------
CREATE TABLE `jobs` (
    `job_id` VARCHAR(36) PRIMARY KEY COMMENT 'UUID format matching Spring Boot UUID',
    `job_name` VARCHAR(150) NOT NULL,
    `language` VARCHAR(32) NOT NULL DEFAULT 'PYTHON',
    `source_code` LONGTEXT NOT NULL,
    `cpu_cores` INT NOT NULL DEFAULT 1,
    `memory_mb` INT NOT NULL DEFAULT 512,
    `storage_mb` INT NOT NULL DEFAULT 1024,
    `max_execution_time_seconds` INT NOT NULL DEFAULT 60,
    `priority` INT NOT NULL DEFAULT 2 COMMENT '1 = Low (0.5x quota), 2 = Normal (1.0x quota), 3 = High (2.0x quota preemption)',
    `scheduling_algorithm` VARCHAR(50) NOT NULL DEFAULT 'AUTO',
    `status` ENUM('QUEUED', 'ASSIGNED', 'RUNNING', 'SUSPENDED', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `user_id` BIGINT NULL,
    `project_id` BIGINT NULL,
    `assigned_server_id` VARCHAR(64) NULL,
    `assigned_node_name` VARCHAR(100) NULL,
    `retry_count` INT NOT NULL DEFAULT 0,
    `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `assigned_at` TIMESTAMP NULL,
    `started_at` TIMESTAMP NULL,
    `completed_at` TIMESTAMP NULL,
    `lease_expires_at` TIMESTAMP NULL,
    CONSTRAINT `fk_jobs_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_jobs_project`
        FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_jobs_assigned_server`
        FOREIGN KEY (`assigned_server_id`) REFERENCES `servers` (`server_id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    -- Fast index for scheduler queue matching: status=QUEUED, order by priority DESC, submitted_at ASC
    INDEX `idx_jobs_queue_scheduling` (`status`, `priority` DESC, `submitted_at` ASC),
    INDEX `idx_jobs_user_status` (`user_id`, `status`),
    INDEX `idx_jobs_assigned_server` (`assigned_server_id`, `status`),
    INDEX `idx_jobs_lease_expiry` (`status`, `lease_expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. JOB_ALLOCATION: Server Resource Allocation Leases for Scheduled Jobs
-- -----------------------------------------------------------------------------
CREATE TABLE `job_allocations` (
    `allocation_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `job_id` VARCHAR(36) NOT NULL,
    `server_id` VARCHAR(64) NOT NULL,
    `allocated_cores` INT NOT NULL,
    `allocated_memory_mb` INT NOT NULL,
    `allocated_storage_mb` INT NOT NULL,
    `lease_duration_seconds` INT NOT NULL DEFAULT 30,
    `lease_expires_at` TIMESTAMP NOT NULL,
    `status` ENUM('ACTIVE', 'RELEASED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `allocated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `released_at` TIMESTAMP NULL,
    CONSTRAINT `fk_job_allocations_job`
        FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_job_allocations_server`
        FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_job_allocations_active` (`server_id`, `status`),
    INDEX `idx_job_allocations_lease` (`status`, `lease_expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. JOB_EXECUTION: Execution History, Runtime Metrics, and Console Output Logs
-- -----------------------------------------------------------------------------
CREATE TABLE `job_executions` (
    `execution_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `job_id` VARCHAR(36) NOT NULL,
    `server_id` VARCHAR(64) NULL,
    `exit_code` INT NULL,
    `duration_ms` BIGINT NULL,
    `stdout` LONGTEXT NULL,
    `stderr` LONGTEXT NULL,
    `error_message` TEXT NULL,
    `executed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_job_executions_job`
        FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_job_executions_server`
        FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_job_executions_job` (`job_id`),
    INDEX `idx_job_executions_date` (`executed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. QUOTA: User and Project Resource Allocation Limits
-- -----------------------------------------------------------------------------
CREATE TABLE `quotas` (
    `quota_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NULL UNIQUE,
    `project_id` BIGINT NULL UNIQUE,
    `max_concurrent_jobs` INT NOT NULL DEFAULT 5,
    `max_cpu_cores` INT NOT NULL DEFAULT 16,
    `max_memory_mb` INT NOT NULL DEFAULT 32768,
    `max_execution_time_seconds` INT NOT NULL DEFAULT 3600,
    `max_daily_jobs` INT NOT NULL DEFAULT 100,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_quotas_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_quotas_project`
        FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    -- Enforce either user_id or project_id is populated, but not both or neither
    CONSTRAINT `chk_quota_target` CHECK (
        (`user_id` IS NOT NULL AND `project_id` IS NULL) OR
        (`user_id` IS NULL AND `project_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. RESERVATION: Advance Cluster Compute Window Reservations
-- -----------------------------------------------------------------------------
CREATE TABLE `reservations` (
    `reservation_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NOT NULL,
    `project_id` BIGINT NULL,
    `server_id` VARCHAR(64) NULL,
    `cores_reserved` INT NOT NULL DEFAULT 1,
    `memory_reserved_mb` INT NOT NULL DEFAULT 2048,
    `purpose` VARCHAR(255) NOT NULL,
    `status` ENUM('REQUESTED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `start_time` TIMESTAMP NOT NULL,
    `end_time` TIMESTAMP NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_reservations_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_reservations_project`
        FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_reservations_server`
        FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX `idx_reservations_window` (`server_id`, `start_time`, `end_time`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
