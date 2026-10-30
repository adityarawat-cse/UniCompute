package edu.unicompute.api.uploads;

import java.util.Base64;

public record ChunkUploadRequest(
        String fileId,
        int chunkIndex,
        int totalChunks,
        String fileName,
        long totalSize,
        String chunkBase64
) {
    public byte[] getDecodedBytes() {
        if (chunkBase64 == null || chunkBase64.isBlank()) {
            return new byte[0];
        }
        String clean = chunkBase64;
        if (clean.contains(",")) {
            clean = clean.substring(clean.indexOf(",") + 1);
        }
        return Base64.getDecoder().decode(clean);
    }
}
