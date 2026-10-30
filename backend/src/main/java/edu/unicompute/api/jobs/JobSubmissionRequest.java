package edu.unicompute.api.jobs;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record JobSubmissionRequest(

        @NotBlank
        @Size(max = 100)
        String jobName,

        @NotBlank
        @Pattern(regexp = "PYTHON|JAVA")
        String language,

        @Size(max = 65536, message = "Source code exceeds 64KB limit")
        String sourceCode,

        @Min(1)
        int cpuCores,

        @Min(1)
        int memoryMb,

        @Min(1)
        int storageMb,

        @Min(1)
        int maxExecutionTimeSeconds,

        @Min(1)
        @Max(3)
        int priority,

        @Pattern(regexp = "FCFS|SJF|PRIORITY|ROUND_ROBIN|AUTO")
        String schedulingAlgorithm
) {
    public JobSubmissionRequest {
        if (sourceCode == null) {
            sourceCode = "";
        }
        if (schedulingAlgorithm == null || schedulingAlgorithm.isBlank()) {
            schedulingAlgorithm = "AUTO";
        }
    }
}
