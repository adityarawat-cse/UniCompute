package edu.unicompute.api.worker;

import java.util.UUID;

import edu.unicompute.api.jobs.Job;
import edu.unicompute.api.jobs.JobService;
import edu.unicompute.api.jobs.JobStatus;
import edu.unicompute.api.jobs.JobSubmissionRequest;
import edu.unicompute.api.nodes.ClusterNode;
import edu.unicompute.api.nodes.NodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class WorkerExecutionFlowTest {

    @Autowired
    private NodeService nodeService;

    @Autowired
    private JobService jobService;

    @Autowired
    private WorkerApiController workerApiController;

    @Autowired(required = false)
    private edu.unicompute.api.users.UserService userService;

    private String workerToken;
    private String nodeId;

    @BeforeEach
    void setUp() {
        // Use pre-seeded node-2 with token uc_tok_3910
        this.nodeId = "node-2";
        this.workerToken = "uc_tok_3910";
        jobService.clearAllJobs();
        for (ClusterNode n : nodeService.findAll()) {
            nodeService.setNodeAvailable(n.id());
        }
    }

    @Test
    @DisplayName("End-to-End: Submission -> Worker Poll receives code -> Start Ack -> Result Complete")
    void testEndToEndWorkerExecution() {
        String testCode = "import sys\nprint('Result: 42')\nsys.exit(0)";
        JobSubmissionRequest submitReq = new JobSubmissionRequest(
                "PyCalculate",
                "PYTHON",
                testCode,
                2,
                1024,
                100,
                30,
                3,
                "FCFS"
        );
        Job submittedJob = jobService.submit(submitReq);
        assertEquals(JobStatus.QUEUED, submittedJob.status());

        // 1. Worker polls for work
        WorkerPollRequest pollReq = new WorkerPollRequest(4, 4096);
        ResponseEntity<?> pollResponse = workerApiController.pollForJob(workerToken, pollReq);
        assertEquals(HttpStatus.OK, pollResponse.getStatusCode());
        assertTrue(pollResponse.getBody() instanceof WorkerJobManifest);

        WorkerJobManifest manifest = (WorkerJobManifest) pollResponse.getBody();
        assertEquals(submittedJob.jobId(), manifest.jobId());
        assertEquals("PYTHON", manifest.language());
        assertEquals(testCode, manifest.sourceCode());

        // Verify Node is marked Busy and assigned
        ClusterNode busyNode = nodeService.findAll().stream()
                .filter(n -> n.id().equals(nodeId))
                .findFirst().orElseThrow();
        assertEquals("Busy", busyNode.status());
        assertEquals(submittedJob.jobId(), busyNode.activeJobId());

        // 2. Worker acknowledges start
        WorkerStartAckRequest startAck = new WorkerStartAckRequest(manifest.jobId());
        ResponseEntity<?> ackResp = workerApiController.acknowledgeStart(workerToken, startAck);
        assertEquals(HttpStatus.OK, ackResp.getStatusCode());

        Job runningJob = jobService.findById(submittedJob.jobId()).orElseThrow();
        assertEquals(JobStatus.RUNNING, runningJob.status());

        // 3. Worker reports completion with stdout
        WorkerResultRequest resultReq = new WorkerResultRequest(
                manifest.jobId(),
                "COMPLETED",
                0,
                1420L,
                "Result: 42\n",
                ""
        );
        ResponseEntity<?> resResp = workerApiController.reportResult(workerToken, resultReq);
        assertEquals(HttpStatus.OK, resResp.getStatusCode());

        Job completedJob = jobService.findById(submittedJob.jobId()).orElseThrow();
        assertEquals(JobStatus.COMPLETED, completedJob.status());
        assertEquals("Result: 42\n", completedJob.stdout());
        assertEquals(0, completedJob.exitCode());
        assertEquals(1420L, completedJob.executionDurationMs());

        // Node is released back to Available
        ClusterNode releasedNode = nodeService.findAll().stream()
                .filter(n -> n.id().equals(nodeId))
                .findFirst().orElseThrow();
        assertEquals("Available", releasedNode.status());
        assertNull(releasedNode.activeJobId());
    }

    @Test
    @DisplayName("Worker reports execution error (non-zero exit code + stderr) -> FAILED status")
    void testWorkerExecutionError() {
        String badCode = "raise ValueError('Simulated student script crash')";
        JobSubmissionRequest submitReq = new JobSubmissionRequest(
                "ErrorProneJob",
                "PYTHON",
                badCode,
                1,
                512,
                100,
                20,
                2,
                "FCFS"
        );
        Job submitted = jobService.submit(submitReq);

        WorkerPollRequest pollReq = new WorkerPollRequest(4, 4096);
        ResponseEntity<?> pollResponse = workerApiController.pollForJob(workerToken, pollReq);
        WorkerJobManifest manifest = (WorkerJobManifest) pollResponse.getBody();

        workerApiController.acknowledgeStart(workerToken, new WorkerStartAckRequest(manifest.jobId()));

        // Worker reports script crash
        String simulatedStderr = "Traceback (most recent call last):\n  File \"script.py\", line 1\nValueError: Simulated student script crash\n";
        WorkerResultRequest errorResult = new WorkerResultRequest(
                manifest.jobId(),
                "FAILED",
                1,
                450L,
                "",
                simulatedStderr
        );
        workerApiController.reportResult(workerToken, errorResult);

        Job failedJob = jobService.findById(submitted.jobId()).orElseThrow();
        assertEquals(JobStatus.FAILED, failedJob.status());
        assertEquals(1, failedJob.exitCode());
        assertTrue(failedJob.stderr().contains("ValueError: Simulated student script crash"));
    }

    @Test
    @DisplayName("Watchdog timeout execution -> FAILED with timeout details")
    void testWorkerTimeoutReporting() {
        JobSubmissionRequest submitReq = new JobSubmissionRequest(
                "InfiniteLoopJob",
                "PYTHON",
                "while True: pass",
                1,
                512,
                100,
                5,
                1,
                "FCFS"
        );
        Job submitted = jobService.submit(submitReq);

        WorkerPollRequest pollReq = new WorkerPollRequest(4, 4096);
        ResponseEntity<?> pollResponse = workerApiController.pollForJob(workerToken, pollReq);
        WorkerJobManifest manifest = (WorkerJobManifest) pollResponse.getBody();

        workerApiController.acknowledgeStart(workerToken, new WorkerStartAckRequest(manifest.jobId()));

        WorkerResultRequest timeoutResult = new WorkerResultRequest(
                manifest.jobId(),
                "FAILED",
                124,
                5100L,
                "",
                "Execution exceeded wall-clock timeout of 5s. Process terminated by worker watchdog.\n"
        );
        workerApiController.reportResult(workerToken, timeoutResult);

        Job timedOutJob = jobService.findById(submitted.jobId()).orElseThrow();
        assertEquals(JobStatus.FAILED, timedOutJob.status());
        assertEquals(124, timedOutJob.exitCode());
        assertTrue(timedOutJob.stderr().contains("Execution exceeded wall-clock timeout"));
    }

    @Test
    @DisplayName("Job cancellation: Student cancels -> Heartbeat tells worker CANCEL_JOB")
    void testJobCancellationFlow() {
        JobSubmissionRequest submitReq = new JobSubmissionRequest(
                "CancelMeJob",
                "PYTHON",
                "import time\ntime.sleep(60)",
                1,
                512,
                100,
                60,
                1,
                "FCFS"
        );
        Job submitted = jobService.submit(submitReq);

        WorkerPollRequest pollReq = new WorkerPollRequest(4, 4096);
        ResponseEntity<?> pollResponse = workerApiController.pollForJob(workerToken, pollReq);
        WorkerJobManifest manifest = (WorkerJobManifest) pollResponse.getBody();

        workerApiController.acknowledgeStart(workerToken, new WorkerStartAckRequest(manifest.jobId()));

        // Student cancels the job
        boolean cancelled = jobService.cancelJob(submitted.jobId());
        assertTrue(cancelled);
        assertEquals(JobStatus.CANCELLED, jobService.findById(submitted.jobId()).orElseThrow().status());

        // Worker sends heartbeat while running
        WorkerHeartbeatRequest hb = new WorkerHeartbeatRequest(manifest.jobId(), true, "Python 3.11");
        ResponseEntity<WorkerHeartbeatResponse> hbResp = workerApiController.workerHeartbeat(workerToken, hb);
        assertEquals(HttpStatus.OK, hbResp.getStatusCode());
        assertNotNull(hbResp.getBody());
        assertEquals("CANCEL_JOB", hbResp.getBody().command());
    }

    @Test
    @DisplayName("Output flooding: stdout truncated to cap is stored safely without blocking")
    void testOutputFloodingCapture() {
        JobSubmissionRequest submitReq = new JobSubmissionRequest(
                "FloodJob",
                "PYTHON",
                "for i in range(1000000): print('Data line', i)",
                1,
                512,
                100,
                30,
                1,
                "FCFS"
        );
        Job submitted = jobService.submit(submitReq);

        WorkerPollRequest pollReq = new WorkerPollRequest(4, 4096);
        ResponseEntity<?> pollResponse = workerApiController.pollForJob(workerToken, pollReq);
        WorkerJobManifest manifest = (WorkerJobManifest) pollResponse.getBody();

        workerApiController.acknowledgeStart(workerToken, new WorkerStartAckRequest(manifest.jobId()));

        // 32 KB string + warning notice
        String floodedOutput = "x".repeat(32768) + "\n[Output truncated: exceeded 32KB limit]\n";
        WorkerResultRequest floodResult = new WorkerResultRequest(
                manifest.jobId(),
                "COMPLETED",
                0,
                2500L,
                floodedOutput,
                ""
        );
        workerApiController.reportResult(workerToken, floodResult);

        Job completedJob = jobService.findById(submitted.jobId()).orElseThrow();
        assertEquals(JobStatus.COMPLETED, completedJob.status());
        assertTrue(completedJob.stdout().contains("[Output truncated: exceeded 32KB limit]"));
        assertEquals(0, completedJob.exitCode());
    }

    @Test
    @DisplayName("Invalid or unauthorized worker token is rejected with 401")
    void testUnauthorizedWorkerToken() {
        WorkerPollRequest pollReq = new WorkerPollRequest(4, 4096);
        ResponseEntity<?> resp = workerApiController.pollForJob("invalid_token_999", pollReq);
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    @Test
    @DisplayName("B-3 Quota: Upfront reservation, early finish refund, cancellation refund, and insufficient quota check")
    void testQuotaAccountingAndRefunds() {
        if (userService == null) return;

        var studentOpt = userService.findAllUsers().stream()
                .filter(u -> "student".equalsIgnoreCase(u.username()))
                .findFirst();
        if (studentOpt.isEmpty()) return;

        Long studentId = studentOpt.get().userId();
        // Reset student used quota to 0
        userService.refundUsage(studentId, 100000);

        int initialUsed = userService.findById(studentId).orElseThrow().usedQuotaSeconds();
        assertEquals(0, initialUsed);

        // 1. Submit job requesting 30s
        JobSubmissionRequest req1 = new JobSubmissionRequest(
                "ShortFastJob",
                "PYTHON",
                "print('done fast')",
                1,
                512,
                100,
                30,
                2,
                "FCFS",
                studentId
        );
        Job job1 = jobService.submit(req1);
        assertEquals(30, userService.findById(studentId).orElseThrow().usedQuotaSeconds());

        // 2. Poll and report finished in 10s (10,000 ms)
        WorkerPollRequest pollReq = new WorkerPollRequest(4, 4096);
        ResponseEntity<?> pollResp = workerApiController.pollForJob(workerToken, pollReq);
        assertEquals(HttpStatus.OK, pollResp.getStatusCode());

        workerApiController.acknowledgeStart(workerToken, new WorkerStartAckRequest(job1.jobId()));
        workerApiController.reportResult(workerToken, new WorkerResultRequest(
                job1.jobId(),
                "COMPLETED",
                0,
                10000L,
                "done fast\n",
                ""
        ));

        // 3. Early finish refund: 30s - 10s = 20s refunded, so used quota is now 10s
        assertEquals(10, userService.findById(studentId).orElseThrow().usedQuotaSeconds());

        // 4. Submit a second job for 50s
        JobSubmissionRequest req2 = new JobSubmissionRequest(
                "WillCancelJob",
                "PYTHON",
                "print('cancel')",
                1,
                512,
                100,
                50,
                2,
                "FCFS",
                studentId
        );
        Job job2 = jobService.submit(req2);
        // Used quota is now 10 + 50 = 60s
        assertEquals(60, userService.findById(studentId).orElseThrow().usedQuotaSeconds());

        // 5. Cancel the job before execution -> 50s refunded back
        boolean cancelled = jobService.cancelJob(job2.jobId());
        assertTrue(cancelled);
        assertEquals(10, userService.findById(studentId).orElseThrow().usedQuotaSeconds());

        // 6. Insufficient quota check
        JobSubmissionRequest reqHuge = new JobSubmissionRequest(
                "ExceedsAllQuota",
                "PYTHON",
                "print('huge')",
                1,
                512,
                100,
                50000,
                2,
                "FCFS",
                studentId
        );
        assertThrows(IllegalArgumentException.class, () -> jobService.submit(reqHuge));
    }

    @Test
    @DisplayName("B-8 Telemetry: Worker streams hardware process metrics -> stored and retrievable via API")
    void testSynchronizedProcessTelemetry() {
        JobSubmissionRequest submitReq = new JobSubmissionRequest(
                "TelemetryProfilingJob",
                "PYTHON",
                "import time\ntime.sleep(2)",
                2,
                1024,
                200,
                30,
                2,
                "FCFS"
        );
        Job submitted = jobService.submit(submitReq);

        // Worker reports live telemetry sample points
        WorkerTelemetryRequest telem1 = new WorkerTelemetryRequest(
                submitted.jobId(),
                35.5,
                320.0,
                4,
                1000L
        );
        ResponseEntity<Void> postResp = workerApiController.reportTelemetry(workerToken, telem1);
        assertEquals(HttpStatus.OK, postResp.getStatusCode());

        WorkerTelemetryRequest telem2 = new WorkerTelemetryRequest(
                submitted.jobId(),
                78.2,
                640.0,
                8,
                2000L
        );
        workerApiController.reportTelemetry(workerToken, telem2);

        // Retrieve telemetry via JobService
        var points = jobService.getTelemetry(submitted.jobId());
        assertEquals(2, points.size());
        assertEquals(35.5, points.get(0).cpuUsagePercent());
        assertEquals(320.0, points.get(0).memoryMb());
        assertEquals(78.2, points.get(1).cpuUsagePercent());
        assertEquals(640.0, points.get(1).memoryMb());
    }

    @Test
    @DisplayName("B-2 Preemption: High priority job preempts running low priority job -> worker receives PAUSE_JOB -> resumes after completion")
    void testProcessPreemptionAndResume() {
        // Ensure node-2 is available
        nodeService.setNodeAvailable(nodeId);

        // 1. Submit Low priority job (priority = 1)
        JobSubmissionRequest lowReq = new JobSubmissionRequest(
                "LowPriorityBackgroundJob",
                "PYTHON",
                "import time\ntime.sleep(60)",
                1,
                512,
                100,
                60,
                1,
                "FCFS"
        );
        Job lowJob = jobService.submit(lowReq);

        // 2. Worker polls and claims Low priority job
        WorkerPollRequest pollReq = new WorkerPollRequest(4, 4096);
        ResponseEntity<?> poll1 = workerApiController.pollForJob(workerToken, pollReq);
        assertEquals(HttpStatus.OK, poll1.getStatusCode());
        WorkerJobManifest manifest1 = (WorkerJobManifest) poll1.getBody();
        assertEquals(lowJob.jobId(), manifest1.jobId());

        // Worker acknowledges start -> Job is RUNNING
        workerApiController.acknowledgeStart(workerToken, new WorkerStartAckRequest(lowJob.jobId()));
        assertEquals(JobStatus.RUNNING, jobService.findById(lowJob.jobId()).orElseThrow().status());

        // Ensure other nodes are busy so node-2 is the sole compute resource for preemption
        for (ClusterNode n : nodeService.findAll()) {
            if (!n.id().equals(nodeId)) {
                nodeService.setNodeBusy(n.id(), UUID.randomUUID());
            }
        }

        // 3. High priority job arrives (priority = 3) while all nodes are busy
        JobSubmissionRequest highReq = new JobSubmissionRequest(
                "UrgentHighPriorityJob",
                "PYTHON",
                "print('urgent')",
                1,
                512,
                100,
                30,
                3,
                "PRIORITY"
        );
        Job highJob = jobService.submit(highReq);

        // 4. Verify low-priority job was preempted and transitioned to SUSPENDED
        Job victim = jobService.findById(lowJob.jobId()).orElseThrow();
        assertEquals(JobStatus.SUSPENDED, victim.status());

        // 5. Worker sends heartbeat while running lowJob -> receives PAUSE_JOB signal
        WorkerHeartbeatRequest hbReq = new WorkerHeartbeatRequest(lowJob.jobId(), true, "Python 3.11");
        ResponseEntity<WorkerHeartbeatResponse> hbResp = workerApiController.workerHeartbeat(workerToken, hbReq);
        assertEquals(HttpStatus.OK, hbResp.getStatusCode());
        assertNotNull(hbResp.getBody());
        assertEquals("PAUSE_JOB", hbResp.getBody().command());

        // 6. Worker polls again -> Node is available, gets High priority job
        ResponseEntity<?> poll2 = workerApiController.pollForJob(workerToken, pollReq);
        assertEquals(HttpStatus.OK, poll2.getStatusCode());
        WorkerJobManifest manifest2 = (WorkerJobManifest) poll2.getBody();
        assertEquals(highJob.jobId(), manifest2.jobId());

        workerApiController.acknowledgeStart(workerToken, new WorkerStartAckRequest(highJob.jobId()));
        assertEquals(JobStatus.RUNNING, jobService.findById(highJob.jobId()).orElseThrow().status());

        // 7. High priority job finishes
        workerApiController.reportResult(workerToken, new WorkerResultRequest(
                highJob.jobId(),
                "COMPLETED",
                0,
                1200L,
                "urgent\n",
                ""
        ));
        assertEquals(JobStatus.COMPLETED, jobService.findById(highJob.jobId()).orElseThrow().status());

        // 8. Low priority job is automatically restored to RUNNING
        Job resumed = jobService.findById(lowJob.jobId()).orElseThrow();
        assertEquals(JobStatus.RUNNING, resumed.status());

        // 9. On subsequent heartbeat, worker receives RESUME_JOB command
        ResponseEntity<WorkerHeartbeatResponse> hbResumeResp = workerApiController.workerHeartbeat(workerToken, null);
        assertEquals(HttpStatus.OK, hbResumeResp.getStatusCode());
        assertNotNull(hbResumeResp.getBody());
        assertEquals("RESUME_JOB", hbResumeResp.getBody().command());
        assertEquals(lowJob.jobId(), hbResumeResp.getBody().targetJobId());
    }
}
