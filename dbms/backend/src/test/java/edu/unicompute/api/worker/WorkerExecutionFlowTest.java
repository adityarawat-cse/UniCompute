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

    private String workerToken;
    private String nodeId;

    @BeforeEach
    void setUp() {
        // Use pre-seeded node-2 with token uc_tok_3910
        this.nodeId = "node-2";
        this.workerToken = "uc_tok_3910";
        nodeService.setNodeAvailable(this.nodeId);
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
}
