# UniCompute MySQL 8 Database

This directory contains the relational database schema, data dictionaries, and seed scripts for the **UniCompute** distributed campus computing platform.

---

## Architecture Decisions

- **Engine:** MySQL 8.0+ with InnoDB and `utf8mb4_unicode_ci`.
- **Purpose:** Durable persistence for user accounts, projects, computing job states, node records, resource allocations, execution history, quotas, and compute reservations.
- **Gossip / Telemetry Distinction:** Real-time sub-second node telemetry and health heartbeats are exchanged via lightweight HTTP heartbeats / gossip directly to the cluster nodes. MySQL stores persistent records, historical telemetry snapshots, and durable queue states.
- **UUID Job Identifiers:** Job IDs are stored as 36-character UUID strings (`VARCHAR(36)`), perfectly matching Spring Boot's `java.util.UUID`.

---

## Table Structure

| Table | Description | Primary Key | Key Foreign Keys |
|---|---|---|---|
| `users` | User accounts, credentials hash, departments, and roles (`ADMIN`, `RESEARCHER`, `STUDENT`) | `user_id` (BIGINT AUTO_INCREMENT) | None |
| `projects` | Academic and lab research projects | `project_id` (BIGINT AUTO_INCREMENT) | `owner_user_id` -> `users(user_id)` |
| `servers` | Cluster worker machines (mirrors `ClusterNode` entity) | `server_id` (VARCHAR(64)) | None |
| `server_resources` | Hardware specs: CPU cores, RAM, storage, and GPU info per node | `resource_id` (BIGINT AUTO_INCREMENT) | `server_id` -> `servers(server_id)` |
| `jobs` | Distributed computing job queue (mirrors `Job` record) | `job_id` (VARCHAR(36)) | `user_id`, `project_id`, `assigned_server_id` |
| `job_allocations` | Active resource leases awarded by the scheduler | `allocation_id` (BIGINT AUTO_INCREMENT) | `job_id` -> `jobs`, `server_id` -> `servers` |
| `job_executions` | Historical execution output, logs (stdout/stderr), exit codes, and durations | `execution_id` (BIGINT AUTO_INCREMENT) | `job_id` -> `jobs`, `server_id` -> `servers` |
| `quotas` | Compute limits (max cores, memory, daily jobs) per user or project | `quota_id` (BIGINT AUTO_INCREMENT) | `user_id` -> `users`, `project_id` -> `projects` |
| `reservations` | Advance node reservation requests | `reservation_id` (BIGINT AUTO_INCREMENT) | `user_id`, `project_id`, `server_id` |

---

## Quick Setup Instructions

### 1. Using Docker (Fastest)

```bash
docker run --name unicompute-mysql \
  -e MYSQL_ROOT_PASSWORD=unicompute_root \
  -e MYSQL_DATABASE=unicompute_db \
  -e MYSQL_USER=unicompute \
  -e MYSQL_PASSWORD=unicompute_pass \
  -p 3306:3306 -d mysql:8.0
```

### 2. Initialize Schema & Sample Data

```bash
# Apply schema
mysql -u unicompute -punicompute_pass unicompute_db < database/schema.sql

# Apply seed data (optional)
mysql -u unicompute -punicompute_pass unicompute_db < database/seed.sql
```

### 3. Spring Boot Integration

Update `backend/src/main/resources/application.properties`:
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/unicompute_db?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
spring.datasource.username=unicompute
spring.datasource.password=unicompute_pass
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQLDialect
```
