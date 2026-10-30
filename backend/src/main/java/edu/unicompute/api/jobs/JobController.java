package edu.unicompute.api.jobs;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import edu.unicompute.api.common.ResourceNotFoundException;
import edu.unicompute.api.uploads.ChunkUploadRequest;
import edu.unicompute.api.uploads.ChunkUploadResponse;
import edu.unicompute.api.uploads.UploadService;
import edu.unicompute.api.uploads.UploadStatusResponse;
import jakarta.validation.Valid;

@RestController
public class JobController {

    private final JobService jobService;
    private final UploadService uploadService;

    @Autowired
    public JobController(JobService jobService, @Autowired(required = false) UploadService uploadService) {
        this.jobService = jobService;
        this.uploadService = uploadService != null ? uploadService : new UploadService();
    }

    public JobController(JobService jobService) {
        this(jobService, new UploadService());
    }

    @PostMapping("/api/jobs/validate")
    public JobSubmissionRequest validateSubmission(
            @Valid @RequestBody JobSubmissionRequest request) {
        return request;
    }

    @PostMapping("/api/jobs/predict")
    public ResponseEntity<AiPredictionResult> predictRuntimeAndPolicy(
            @RequestBody JobSubmissionRequest request) {
        return ResponseEntity.ok(jobService.predictRuntimeAndPolicy(request));
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

    @PostMapping(value = "/api/jobs/upload-chunk", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ChunkUploadResponse> uploadChunkMultipart(
            @RequestParam("fileId") String fileId,
            @RequestParam("chunkIndex") int chunkIndex,
            @RequestParam("totalChunks") int totalChunks,
            @RequestParam(value = "fileName", defaultValue = "workload.zip") String fileName,
            @RequestParam(value = "totalSize", defaultValue = "0") long totalSize,
            @RequestParam("chunk") MultipartFile chunk
    ) throws IOException {
        ChunkUploadResponse res = uploadService.saveChunk(
                fileId, chunkIndex, totalChunks, fileName, totalSize, chunk.getBytes());
        return ResponseEntity.ok(res);
    }

    @PostMapping(value = "/api/jobs/upload-chunk", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChunkUploadResponse> uploadChunkJson(
            @RequestBody ChunkUploadRequest request
    ) throws IOException {
        ChunkUploadResponse res = uploadService.saveChunk(
                request.fileId(),
                request.chunkIndex(),
                request.totalChunks(),
                request.fileName(),
                request.totalSize(),
                request.getDecodedBytes());
        return ResponseEntity.ok(res);
    }

    @GetMapping("/api/jobs/upload-status/{fileId}")
    public ResponseEntity<UploadStatusResponse> getUploadStatus(@PathVariable String fileId) {
        return ResponseEntity.ok(uploadService.getUploadStatus(fileId));
    }

    @GetMapping("/api/jobs/upload-file/{fileId}")
    public ResponseEntity<Resource> downloadAssembledFile(@PathVariable String fileId) {
        Path path = uploadService.getAssembledFilePath(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("Uploaded file not found or not yet assembled for ID: " + fileId));
        Resource resource = new FileSystemResource(path);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + path.getFileName().toString() + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }
}
