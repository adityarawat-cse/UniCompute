package edu.unicompute.api.worker;

import java.util.UUID;
import jakarta.validation.constraints.NotNull;

public record WorkerStartAckRequest(
        @NotNull
        UUID jobId
) {
}
