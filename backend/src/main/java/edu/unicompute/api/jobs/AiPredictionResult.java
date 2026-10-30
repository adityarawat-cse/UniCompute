package edu.unicompute.api.jobs;

public record AiPredictionResult(
        int predictedDurationSeconds,
        String optimalAlgorithm,
        String reasoning,
        int linesOfCode,
        int tokenCount,
        double complexityScore
) {}
