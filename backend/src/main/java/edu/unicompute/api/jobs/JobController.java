package edu.unicompute.api.jobs;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import edu.unicompute.api.common.ResourceNotFoundException;
import jakarta.validation.Valid;

@RestController
public class JobController {

    private final JobService jobService;

    public JobController(JobService jobService) {
        this.jobService = jobService;
    }

    @PostMapping("/api/jobs/validate")
    public JobSubmissionRequest validateSubmission(
            @Valid @RequestBody JobSubmissionRequest request) {
        return request;
    }

    @PostMapping("/api/jobs")
    public ResponseEntity<Job> submitJob(
            @Valid @RequestBody JobSubmissionRequest request) {
        Job job = jobService.submit(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(job);
    }

    @GetMapping("/api/jobs")
    public ResponseEntity<List<Job>> getAllJobs() {
        return ResponseEntity.ok(jobService.findAll());
    }

    @GetMapping("/api/jobs/{id}")
    public ResponseEntity<Job> getJobById(@PathVariable UUID id) {
        Job job = jobService.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found with ID: " + id));
        return ResponseEntity.ok(job);
    }

    @PostMapping("/api/jobs/{id}/cancel")
    public ResponseEntity<Job> cancelJob(@PathVariable UUID id) {
        boolean cancelled = jobService.cancelJob(id);
        if (!cancelled) {
            Job job = jobService.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Job not found with ID: " + id));
            return ResponseEntity.status(HttpStatus.CONFLICT).body(job);
        }
        return ResponseEntity.ok(jobService.findById(id).orElseThrow());
    }

    @GetMapping("/api/jobs/{id}/telemetry")
    public ResponseEntity<List<edu.unicompute.api.worker.TelemetryDataPoint>> getJobTelemetry(@PathVariable UUID id) {
        return ResponseEntity.ok(jobService.getTelemetry(id));
    }
}