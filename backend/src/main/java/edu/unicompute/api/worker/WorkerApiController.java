package edu.unicompute.api.worker;

import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import edu.unicompute.api.jobs.Job;
import edu.unicompute.api.jobs.JobService;
import edu.unicompute.api.jobs.JobStatus;
import edu.unicompute.api.nodes.ClusterNode;
import edu.unicompute.api.nodes.NodeService;
import jakarta.validation.Valid;

@RestController
public class WorkerApiController {

    private final JobService jobService;
    private final NodeService nodeService;

    public WorkerApiController(JobService jobService, NodeService nodeService) {
        this.jobService = jobService;
        this.nodeService = nodeService;
    }

    @PostMapping("/api/worker/poll")
    public ResponseEntity<WorkerJobManifest> pollForJob(
            @RequestHeader(value = "X-Node-Token", required = false) String token,
            @Valid @RequestBody WorkerPollRequest req) {

        if (token == null || token.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Optional<ClusterNode> nodeOpt = nodeService.findByToken(token);
        if (nodeOpt.isEmpty() || !nodeOpt.get().online()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        ClusterNode node = nodeOpt.get();
        Optional<WorkerJobManifest> manifest = jobService.pollAndAssignJob(
                node,
                req.availableCores(),
                req.availableMemoryMb()
        );

        if (manifest.isPresent()) {
            return ResponseEntity.ok(manifest.get());
        } else {
            return ResponseEntity.noContent().build();
        }
    }

    @PostMapping("/api/worker/start-ack")
    public ResponseEntity<Void> acknowledgeStart(
            @RequestHeader(value = "X-Node-Token", required = false) String token,
            @Valid @RequestBody WorkerStartAckRequest req) {

        if (token == null || token.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Optional<ClusterNode> nodeOpt = nodeService.findByToken(token);
        if (nodeOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        boolean ack = jobService.acknowledgeStart(req.jobId(), nodeOpt.get().id());
        if (ack) {
            return ResponseEntity.ok().build();
        } else {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }

    @PostMapping("/api/worker/heartbeat")
    public ResponseEntity<WorkerHeartbeatResponse> workerHeartbeat(
            @RequestHeader(value = "X-Node-Token", required = false) String token,
            @RequestBody(required = false) WorkerHeartbeatRequest req) {

        if (token == null || token.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Optional<ClusterNode> nodeOpt = nodeService.findByToken(token);
        if (nodeOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        UUID activeJobId = (req != null) ? req.activeJobId() : null;
        Boolean pyAvail = (req != null && req.pythonAvailable() != null) ? req.pythonAvailable() : true;
        String pyVer = (req != null && req.pythonVersion() != null) ? req.pythonVersion() : "Python 3";
        Boolean javaAvail = (req != null && req.javaAvailable() != null) ? req.javaAvailable() : true;
        String javaVer = (req != null && req.javaVersion() != null) ? req.javaVersion() : "Java 17";

        nodeService.recordWorkerHeartbeat(token, activeJobId, pyAvail, pyVer, javaAvail, javaVer);

        // Check if the worker is executing a job that has been cancelled or preempted (B-2)
        if (activeJobId != null) {
            Optional<Job> jobOpt = jobService.findById(activeJobId);
            if (jobOpt.isPresent()) {
                Job currentJob = jobOpt.get();
                if (currentJob.status() == JobStatus.CANCELLED) {
                    return ResponseEntity.ok(WorkerHeartbeatResponse.cancel("Cancelled", activeJobId));
                }
                if (currentJob.status() == JobStatus.SUSPENDED) {
                    nodeService.setNodeAvailable(nodeOpt.get().id());
                    return ResponseEntity.ok(WorkerHeartbeatResponse.pause("Suspended", activeJobId));
                }
            }
        }

        // Check if there is a pending resume command for a preempted job on this worker node
        UUID resumeJobId = jobService.checkPendingResume(nodeOpt.get().id());
        if (resumeJobId != null) {
            return ResponseEntity.ok(WorkerHeartbeatResponse.resume("Resumed", resumeJobId));
        }

        ClusterNode fresh = nodeService.findByToken(token).orElse(nodeOpt.get());
        return ResponseEntity.ok(WorkerHeartbeatResponse.none(fresh.status()));
    }

    @PostMapping("/api/worker/result")
    public ResponseEntity<Void> reportResult(
            @RequestHeader(value = "X-Node-Token", required = false) String token,
            @Valid @RequestBody WorkerResultRequest req) {

        if (token == null || token.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Optional<ClusterNode> nodeOpt = nodeService.findByToken(token);
        if (nodeOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        boolean recorded = jobService.recordResult(req, nodeOpt.get().id());
        if (recorded) {
            return ResponseEntity.ok().build();
        } else {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }

    @PostMapping("/api/worker/telemetry")
    public ResponseEntity<Void> reportTelemetry(
            @RequestHeader(value = "X-Node-Token", required = false) String token,
            @RequestBody WorkerTelemetryRequest req) {

        if (token == null || token.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Optional<ClusterNode> nodeOpt = nodeService.findByToken(token);
        if (nodeOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (req != null && req.jobId() != null) {
            jobService.recordTelemetry(req.jobId(), nodeOpt.get().id(), req);
        }
        return ResponseEntity.ok().build();
    }
}
