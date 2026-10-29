package edu.unicompute.api.worker;

import jakarta.validation.constraints.Min;

public record WorkerPollRequest(
        @Min(1)
        int availableCores,

        @Min(1)
        int availableMemoryMb
) {
}
