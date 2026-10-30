package edu.unicompute.api.uploads;

import java.util.List;

public record UploadStatusResponse(
        String fileId,
        String fileName,
        int totalChunks,
        int chunksReceived,
        List<Integer> receivedChunks,
        int lastCheckpointChunk,
        long bytesUploaded,
        long totalSize,
        boolean complete,
        String assembledPath
) {}
