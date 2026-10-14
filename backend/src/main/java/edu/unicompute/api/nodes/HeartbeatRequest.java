package edu.unicompute.api.nodes;

import jakarta.validation.constraints.NotBlank;

public record HeartbeatRequest(
        @NotBlank(message = "Node token is required")
        String token,
        String nodeName,
        Integer cores,
        Integer memoryGb,
        String os
) {
}
