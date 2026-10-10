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

        @Min(1)
        int cpuCores,

        @Min(1)
        int memoryMb,

        @Min(1)
        int storageMb,

        @Min(1)
        int maxExecutionTimeSeconds,

        @Min(1)
        @Max(5)
        int priority,

        @NotBlank
        @Pattern(regexp = "FCFS|SJF|PRIORITY|ROUND_ROBIN")
        String schedulingAlgorithm
) {
}
