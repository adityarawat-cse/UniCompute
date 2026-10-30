package edu.unicompute.api.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import edu.unicompute.api.jobs.Job;
import edu.unicompute.api.jobs.JobService;
import edu.unicompute.api.jobs.JobSubmissionRequest;
import edu.unicompute.api.nodes.ClusterNode;
import edu.unicompute.api.nodes.HeartbeatRequest;
import edu.unicompute.api.nodes.NodeRegistrationRequest;
import edu.unicompute.api.nodes.NodeService;
import edu.unicompute.api.persistence.entity.JobEntity;
import edu.unicompute.api.persistence.entity.ServerEntity;
import edu.unicompute.api.persistence.repository.JobExecutionRepository;
import edu.unicompute.api.persistence.repository.JobRepository;
import edu.unicompute.api.persistence.repository.ServerRepository;
import edu.unicompute.api.persistence.repository.UserRepository;
import edu.unicompute.api.users.UserLoginRequest;
import edu.unicompute.api.users.UserRegistrationRequest;
import edu.unicompute.api.users.UserResponse;
import edu.unicompute.api.users.UserService;
import edu.unicompute.api.worker.WorkerResultRequest;

/**
 * Task D-6: 5-Step End-to-End Persistence and Backend Restart Verification Test.
 * 
 * 1. Connect to Database (MySQL 8 / H2 MySQL-compat).
 * 2. Submit a job & worker execution.
 * 3. Verify row in database tables (jobs, job_executions, servers, users).
 * 4. Restart backend (re-instantiate services connected to database).
 * 5. Confirm records are still retrieved with complete metadata and console logs.
 */
@SpringBootTest
public class EndToEndRestartTest {

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private JobExecutionRepository executionRepository;

    @Autowired
    private ServerRepository serverRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NodeService nodeService;

    @Autowired
    private UserService userService;

    @Autowired
    private JobService jobService;

    @Test
    @DisplayName("D-6: Full 5-Step Persistence Verification Across Backend Restart")
    void testEndToEndRestartPersistence() {
        // Step 1: Verify Database connection
        assertNotNull(jobRepository, "JobRepository must be connected");
        assertNotNull(executionRepository, "JobExecutionRepository must be connected");
        assertNotNull(serverRepository, "ServerRepository must be connected");
        assertNotNull(userRepository, "UserRepository must be connected");

        // Step 2: Register a persistent user and node
        String testUser = "e2e_student_" + System.currentTimeMillis();
        String testEmail = testUser + "@unicompute.edu";
        UserResponse registered = userService.register(new UserRegistrationRequest(
                testUser, testEmail, "pass1234", "E2E Student", "STUDENT", "CSE"
        ));
        assertNotNull(registered.userId());

        ClusterNode registeredNode = nodeService.register(
                new NodeRegistrationRequest("Node-E2E-Worker", 8, 32, "Linux", "node-e2e-1", "uc_tok_e2e_1"),
                "192.168.1.200"
        );
        nodeService.recordHeartbeat(new HeartbeatRequest("uc_tok_e2e_1", "Node-E2E-Worker", 8, 32, "Linux", true, "Python 3.11", true, "Java 21"), "192.168.1.200");

        // Step 2.1: Submit a compute job
        JobSubmissionRequest req = new JobSubmissionRequest(
                "E2E Matrix Multiplication [" + testUser + "]",
                "PYTHON",
                "print('Computing E2E matrix...')\nprint('Complete')",
                4,
                2048,
                512,
                120,
                5,
                "FCFS"
        );
        Job submitted = jobService.submit(req);
        UUID jobId = submitted.jobId();
        assertNotNull(jobId);

        // Simulate execution result from remote worker
        jobService.recordResult(new WorkerResultRequest(
                jobId,
                "COMPLETED",
                0,
                1540L,
                "Matrix multiplication finished successfully.\nNorm: 42.0",
                ""
        ), registeredNode.id());

        // Step 3: Verify row in Database
        Optional<JobEntity> jobInDb = jobRepository.findById(jobId.toString());
        assertTrue(jobInDb.isPresent(), "Job row must exist in MySQL jobs table");
        assertEquals("COMPLETED", jobInDb.get().getStatus().name());

        Optional<ServerEntity> serverInDb = serverRepository.findById(registeredNode.id());
        assertTrue(serverInDb.isPresent(), "Server row must exist in MySQL servers table");

        // Step 4: Simulate Backend Restart
        // By creating a fresh NodeService, UserService, and JobService reading from the same DB
        NodeService restartedNodeService = new NodeService(serverRepository);
        UserService restartedUserService = new UserService(userRepository);
        JobService restartedJobService = new JobService(restartedNodeService, jobRepository, executionRepository, restartedUserService);

        // Step 5: Confirm records are still retrieved after restart
        // 5a. Job and terminal logs
        Optional<Job> restoredJobOpt = restartedJobService.findById(jobId);
        assertTrue(restoredJobOpt.isPresent(), "Job must be restored after backend restart");
        Job restoredJob = restoredJobOpt.get();
        assertEquals("COMPLETED", restoredJob.status().name());
        assertEquals(0, restoredJob.exitCode());
        assertEquals(1540L, restoredJob.executionDurationMs());
        assertNotNull(restoredJob.stdout());
        assertTrue(restoredJob.stdout().contains("Matrix multiplication finished successfully."));

        // 5b. All jobs retrieved
        List<Job> allRestoredJobs = restartedJobService.findAll();
        assertFalse(allRestoredJobs.isEmpty());
        assertTrue(allRestoredJobs.stream().anyMatch(j -> j.jobId().equals(jobId)));

        // 5c. Node persistence verified
        Optional<ClusterNode> restoredNode = restartedNodeService.findById(registeredNode.id());
        assertTrue(restoredNode.isPresent(), "Worker node must be restored after backend restart");

        // 5d. User authentication verified
        Optional<UserResponse> authenticated = restartedUserService.authenticate(testUser, "pass1234");
        assertTrue(authenticated.isPresent(), "User must be able to authenticate after backend restart");
        assertEquals(testEmail, authenticated.get().email());
    }
}

