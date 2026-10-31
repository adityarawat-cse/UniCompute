package edu.unicompute.api.nodes;

import jakarta.validation.constraints.NotBlank;

public record NodeRegistrationRequest(
        String id,
        @NotBlank(message = "Node name cannot be blank")
        String name,
        int cores,
        int memoryGb,
        String os,
        String status,
        String token
) {
}
