package edu.unicompute.api.nodes;

import jakarta.validation.constraints.NotBlank;

public record NodeDisconnectRequest(
        @NotBlank(message = "Node token is required")
        String token
) {
}
