package edu.unicompute.api.uploads;

public record ChunkUploadResponse(
        String fileId,
        int chunkIndex,
        int totalChunks,
        int chunksReceived,
        long bytesUploaded,
        boolean complete,
        String assembledPath,
        String message
) {}
