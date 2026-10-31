-- =============================================================================
-- UniCompute Distributed Campus Cloud Computing Platform
-- Sample Seed Data for MySQL 8
-- =============================================================================

USE `unicompute_db`;

-- 1. Initial Users (Matching App.jsx credentials & system accounts)
INSERT INTO `users` (
    `user_id`, `username`, `email`, `password_hash`, `full_name`, 
    `role`, `status`, `department`, `daily_quota_seconds`, `used_quota_seconds`, `quota_reset_at`
)
VALUES 
    (1, 'admin', 'admin@unicompute.edu', '$2a$12$e8wF3Qv70k2w8uPqIu9hge0B8m0bA2N8w6.0XyZ10MKnqW7s0gYl2', 'System Administrator', 'ADMIN', 'ACTIVE', 'Information Technology', 10000, 0, CURRENT_TIMESTAMP),
    (2, 'aditya', 'aditya@unicompute.edu', '$2a$12$e8wF3Qv70k2w8uPqIu9hge0B8m0bA2N8w6.0XyZ10MKnqW7s0gYl2', 'Aditya Rawat (Admin)', 'ADMIN', 'ACTIVE', 'Computer Science & Engineering', 10000, 0, CURRENT_TIMESTAMP),
    (3, 'student', 'student@unicompute.edu', '$2a$12$e8wF3Qv70k2w8uPqIu9hge0B8m0bA2N8w6.0XyZ10MKnqW7s0gYl2', 'Student Researcher', 'STUDENT', 'ACTIVE', 'Computer Science & Engineering', 1200, 0, CURRENT_TIMESTAMP),
    (4, 'dr_sharma', 'asharma@unicompute.edu', '$2a$12$e8wF3Qv70k2w8uPqIu9hge0B8m0bA2N8w6.0XyZ10MKnqW7s0gYl2', 'Dr. Alok Sharma', 'RESEARCHER', 'ACTIVE', 'Computer Science & Engineering', 7200, 0, CURRENT_TIMESTAMP),
    (5, 'gungun', 'gsaini@unicompute.edu', '$2a$12$e8wF3Qv70k2w8uPqIu9hge0B8m0bA2N8w6.0XyZ10MKnqW7s0gYl2', 'Gungun Saini', 'STUDENT', 'ACTIVE', 'Computer Science & Engineering', 3600, 0, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE 
    `username` = VALUES(`username`),
    `daily_quota_seconds` = VALUES(`daily_quota_seconds`),
    `used_quota_seconds` = VALUES(`used_quota_seconds`);

-- 2. Initial Academic/Research Projects
INSERT INTO `projects` (`project_id`, `project_code`, `title`, `description`, `owner_user_id`, `department`, `status`)
VALUES 
    (1, 'PRJ-CS-2026-DIST', 'High Performance Distributed Computing Research', 'Scalable distributed workloads using heterogeneous university lab machines.', 2, 'Computer Science & Engineering', 'ACTIVE'),
    (2, 'PRJ-MATH-2026-MC', 'Monte Carlo Stochastic Modeling', 'Large-scale statistical calculations and parameter estimations.', 3, 'Mathematics & Computing', 'ACTIVE')
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 3. Initial Cluster Servers (Coordinates with current worker registration)
INSERT INTO `servers` (`server_id`, `node_name`, `ip_address`, `os`, `total_cores`, `total_memory_gb`, `token`, `status`, `is_online`, `python_available`, `python_version`, `java_available`, `java_version`)
VALUES 
    ('uc-node-lab1-01', 'Lab1-Master-Node', '192.168.1.101', 'Windows 11 Pro 64-bit', 8, 16, 'uc_tok_sample101', 'AVAILABLE', TRUE, TRUE, 'Python 3.11.4', TRUE, 'Java 25'),
    ('uc-node-lab1-02', 'Lab1-Compute-Worker-02', '192.168.1.102', 'Ubuntu 24.04 LTS', 16, 32, 'uc_tok_sample102', 'AVAILABLE', TRUE, TRUE, 'Python 3.12.0', TRUE, 'Java 21')
ON DUPLICATE KEY UPDATE `node_name` = VALUES(`node_name`);

-- 4. Server Resources Details
INSERT INTO `server_resources` (`server_id`, `cpu_model`, `cpu_clock_ghz`, `cpu_cores`, `total_ram_mb`, `available_ram_mb`, `storage_mb`, `available_storage_mb`, `gpu_model`, `gpu_count`)
VALUES 
    ('uc-node-lab1-01', 'Intel Core i7-13700H', 2.40, 8, 16384, 12288, 512000, 420000, 'Intel Iris Xe Graphics', 0),
    ('uc-node-lab1-02', 'AMD Ryzen 9 7900X', 4.70, 16, 32768, 28672, 1024000, 850000, 'NVIDIA RTX 4070 Ti', 1)
ON DUPLICATE KEY UPDATE `available_ram_mb` = VALUES(`available_ram_mb`);

-- 5. User Quotas
INSERT INTO `quotas` (`user_id`, `project_id`, `max_concurrent_jobs`, `max_cpu_cores`, `max_memory_mb`, `max_execution_time_seconds`, `max_daily_jobs`)
VALUES 
    (1, NULL, 50, 64, 131072, 86400, 1000),
    (2, NULL, 50, 64, 131072, 86400, 1000),
    (3, NULL, 10, 16, 32768, 7200, 100),
    (4, NULL, 20, 32, 65536, 14400, 200),
    (5, NULL, 5, 8, 16384, 3600, 50)
ON DUPLICATE KEY UPDATE `max_concurrent_jobs` = VALUES(`max_concurrent_jobs`);

-- 6. Sample Initial Job Records (Matching Spring Boot UUID structure & runtimes)
-- Priority tiers: 1 = Low, 2 = Normal, 3 = High
-- Algorithm: AUTO
INSERT INTO `jobs` (
    `job_id`, `job_name`, `language`, `source_code`, 
    `cpu_cores`, `memory_mb`, `storage_mb`, `max_execution_time_seconds`, 
    `priority`, `scheduling_algorithm`, `status`, `user_id`, `project_id`, 
    `assigned_server_id`, `assigned_node_name`, `retry_count`
)
VALUES 
(
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Monte Carlo Pi Estimation',
    'PYTHON',
    'import random\nimport math\n\ndef estimate_pi(num_samples):\n    inside = 0\n    for _ in range(num_samples):\n        x, y = random.random(), random.random()\n        if x**2 + y**2 <= 1.0:\n            inside += 1\n    return (4 * inside) / num_samples\n\nprint("Estimated Pi:", estimate_pi(500000))',
    2,
    1024,
    2048,
    300,
    2,
    'AUTO',
    'COMPLETED',
    3,
    2,
    'uc-node-lab1-01',
    'Lab1-Master-Node',
    0
),
(
    'b2c3d4e5-f6a7-8901-bcde-fa2345678901',
    'Java Distributed Prime Sieve',
    'JAVA',
    'public class Main {\n    public static void main(String[] args) {\n        long start = System.currentTimeMillis();\n        int count = 0;\n        for (int i = 2; i <= 100000; i++) {\n            if (isPrime(i)) count++;\n        }\n        long duration = System.currentTimeMillis() - start;\n        System.out.println("UniCompute Java Worker: Found " + count + " primes in " + duration + "ms");\n    }\n    private static boolean isPrime(int n) {\n        for (int i = 2; i * i <= n; i++) {\n            if (n % i == 0) return false;\n        }\n        return true;\n    }\n}',
    2,
    1024,
    2048,
    300,
    3,
    'AUTO',
    'COMPLETED',
    2,
    1,
    'uc-node-lab1-01',
    'Lab1-Master-Node',
    0
)
ON DUPLICATE KEY UPDATE `job_name` = VALUES(`job_name`);

-- 7. Sample Job Execution Records
INSERT INTO `job_executions` (`job_id`, `server_id`, `exit_code`, `duration_ms`, `stdout`, `stderr`, `error_message`)
VALUES 
(
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'uc-node-lab1-01',
    0,
    1420,
    'Estimated Pi: 3.141528\nExecution completed successfully.\n',
    '',
    NULL
),
(
    'b2c3d4e5-f6a7-8901-bcde-fa2345678901',
    'uc-node-lab1-01',
    0,
    890,
    'UniCompute Java Worker: Found 9592 primes in 48ms\nExecution completed successfully.\n',
    '',
    NULL
);
