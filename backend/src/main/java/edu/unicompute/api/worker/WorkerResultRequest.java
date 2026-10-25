package edu.unicompute.api.worker;

import java.util.UUID;
import jakarta.validation.constraints.NotNull;

public record WorkerResultRequest(
        @NotNull
        UUID jobId,

        @NotNull
        String status,

        Integer exitCode,

        Long executionDurationMs,

        String stdout,

        String stderr
) {
}
