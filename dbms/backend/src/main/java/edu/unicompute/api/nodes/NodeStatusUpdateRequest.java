package edu.unicompute.api.nodes;

import jakarta.validation.constraints.NotBlank;

public record NodeStatusUpdateRequest(
        @NotBlank(message = "Status cannot be blank")
        String status
) {
}
