package edu.unicompute.api.jobs;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(JobController.class)
class JobControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JobService jobService;

    @Test
    @DisplayName("POST /api/jobs/validate returns 200 for valid input")
    void testValidateEndpoint_Valid() throws Exception {
        String validJson = """
                {
                    "jobName": "Matrix Multiplication",
                    "language": "PYTHON",
                    "cpuCores": 4,
                    "memoryMb": 2048,
                    "storageMb": 512,
                    "maxExecutionTimeSeconds": 120,
                    "priority": 5,
                    "schedulingAlgorithm": "PRIORITY"
                }
                """;

        mockMvc.perform(post("/api/jobs/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobName").value("Matrix Multiplication"))
                .andExpect(jsonPath("$.priority").value(5));
    }

    @Test
    @DisplayName("POST /api/jobs returns 201 with created job when valid")
    void testSubmitJob_Success() throws Exception {
        UUID jobId = UUID.randomUUID();
        Instant now = Instant.now();
        Job createdJob = new Job(
                jobId,
                "Render Scene",
                "JAVA",
                2,
                1024,
                256,
                60,
                3,
                "FCFS",
                "QUEUED",
                now
        );

        when(jobService.submit(any(JobSubmissionRequest.class))).thenReturn(createdJob);

        String validJson = """
                {
                    "jobName": "Render Scene",
                    "language": "JAVA",
                    "cpuCores": 2,
                    "memoryMb": 1024,
                    "storageMb": 256,
                    "maxExecutionTimeSeconds": 60,
                    "priority": 3,
                    "schedulingAlgorithm": "FCFS"
                }
                """;

        mockMvc.perform(post("/api/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.jobId").value(jobId.toString()))
                .andExpect(jsonPath("$.jobName").value("Render Scene"))
                .andExpect(jsonPath("$.status").value("QUEUED"))
                .andExpect(jsonPath("$.priority").value(3));
    }

    @Test
    @DisplayName("POST /api/jobs returns 400 when priority is invalid (> 5)")
    void testSubmitJob_InvalidPriority() throws Exception {
        String invalidJson = """
                {
                    "jobName": "Invalid Job",
                    "language": "PYTHON",
                    "cpuCores": 1,
                    "memoryMb": 512,
                    "storageMb": 100,
                    "maxExecutionTimeSeconds": 30,
                    "priority": 8,
                    "schedulingAlgorithm": "FCFS"
                }
                """;

        mockMvc.perform(post("/api/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.validationErrors.priority").exists());
    }

    @Test
    @DisplayName("GET /api/jobs returns 200 with list of jobs")
    void testGetAllJobs() throws Exception {
        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();
        Job job1 = new Job(id1, "Job 1", "PYTHON", 1, 512, 128, 30, 2, "FCFS", "QUEUED", Instant.now().minusSeconds(10));
        Job job2 = new Job(id2, "Job 2", "JAVA", 2, 1024, 256, 60, 4, "PRIORITY", "QUEUED", Instant.now());

        when(jobService.findAll()).thenReturn(List.of(job1, job2));

        mockMvc.perform(get("/api/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].jobId").value(id1.toString()))
                .andExpect(jsonPath("$[1].jobId").value(id2.toString()));
    }

    @Test
    @DisplayName("GET /api/jobs/{id} returns 200 when job exists")
    void testGetJobById_Found() throws Exception {
        UUID jobId = UUID.randomUUID();
        Job job = new Job(jobId, "Target Job", "PYTHON", 1, 512, 128, 30, 2, "FCFS", "QUEUED", Instant.now());

        when(jobService.findById(jobId)).thenReturn(Optional.of(job));

        mockMvc.perform(get("/api/jobs/" + jobId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId").value(jobId.toString()))
                .andExpect(jsonPath("$.jobName").value("Target Job"));
    }

    @Test
    @DisplayName("GET /api/jobs/{id} returns 404 when job does not exist")
    void testGetJobById_NotFound() throws Exception {
        UUID nonExistentId = UUID.randomUUID();

        when(jobService.findById(nonExistentId)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/jobs/" + nonExistentId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Job not found with ID: " + nonExistentId));
    }
}
