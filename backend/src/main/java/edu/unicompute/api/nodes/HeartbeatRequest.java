package edu.unicompute.api.nodes;

import jakarta.validation.constraints.NotBlank;

public record HeartbeatRequest(
        @NotBlank(message = "Node token is required")
        String token,
        String nodeName,
        Integer cores,
        Integer memoryGb,
        String os,
        Boolean pythonAvailable,
        String pythonVersion,
        Boolean javaAvailable,
        String javaVersion
) {
    public HeartbeatRequest(String token, String nodeName, Integer cores, Integer memoryGb, String os) {
        this(token, nodeName, cores, memoryGb, os, true, "Python 3", true, "Java 17");
    }
}
