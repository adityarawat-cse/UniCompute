package edu.unicompute.api.uploads;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UploadServiceTest {

    private Path tempDir;
    private UploadService uploadService;

    @BeforeEach
    void setUp() throws IOException {
        tempDir = Files.createTempDirectory("unicompute_upload_test");
        uploadService = new UploadService(tempDir);
    }

    @AfterEach
    void tearDown() {
        uploadService.clearAllUploads();
    }

    @Test
    @DisplayName("Should save sequential chunks and assemble when final chunk arrives")
    void testSequentialUploadAndAssembly() throws IOException {
        String fileId = "pkg-test-seq-01";
        String fileName = "project.zip";
        byte[] chunk0 = "ChunkZero_".getBytes();
        byte[] chunk1 = "ChunkOne_".getBytes();
        byte[] chunk2 = "ChunkTwoFinal".getBytes();
        long totalSize = chunk0.length + chunk1.length + chunk2.length;

        // Upload chunk 0
        ChunkUploadResponse r0 = uploadService.saveChunk(fileId, 0, 3, fileName, totalSize, chunk0);
        assertFalse(r0.complete());
        assertEquals(1, r0.chunksReceived());

        // Status checkpoint
        UploadStatusResponse status = uploadService.getUploadStatus(fileId);
        assertEquals(0, status.lastCheckpointChunk());
        assertEquals(List.of(0), status.receivedChunks());
        assertFalse(status.complete());

        // Upload chunk 1
        ChunkUploadResponse r1 = uploadService.saveChunk(fileId, 1, 3, fileName, totalSize, chunk1);
        assertFalse(r1.complete());
        assertEquals(2, r1.chunksReceived());

        status = uploadService.getUploadStatus(fileId);
        assertEquals(1, status.lastCheckpointChunk());
        assertEquals(List.of(0, 1), status.receivedChunks());

        // Upload chunk 2 (final)
        ChunkUploadResponse r2 = uploadService.saveChunk(fileId, 2, 3, fileName, totalSize, chunk2);
        assertTrue(r2.complete());
        assertNotNull(r2.assembledPath());

        // Verify status reflects completion
        UploadStatusResponse finalStatus = uploadService.getUploadStatus(fileId);
        assertTrue(finalStatus.complete());
        assertEquals(totalSize, finalStatus.bytesUploaded());

        // Verify assembled content
        Path assembledPath = uploadService.getAssembledFilePath(fileId).orElseThrow();
        byte[] assembledBytes = Files.readAllBytes(assembledPath);
        byte[] expected = "ChunkZero_ChunkOne_ChunkTwoFinal".getBytes();
        assertArrayEquals(expected, assembledBytes);
    }

    @Test
    @DisplayName("Should assemble correctly when chunks arrive out-of-order")
    void testOutOfOrderUpload() throws IOException {
        String fileId = "pkg-test-ooo-02";
        String fileName = "dataset.bin";
        byte[] chunk0 = "PartA".getBytes();
        byte[] chunk1 = "PartB".getBytes();
        byte[] chunk2 = "PartC".getBytes();
        long totalSize = chunk0.length + chunk1.length + chunk2.length;

        // Arrive: chunk 2 first
        ChunkUploadResponse r2 = uploadService.saveChunk(fileId, 2, 3, fileName, totalSize, chunk2);
        assertFalse(r2.complete());
        assertEquals(1, r2.chunksReceived());

        // Last contiguous checkpoint should be -1 because chunk 0 is missing
        UploadStatusResponse s1 = uploadService.getUploadStatus(fileId);
        assertEquals(-1, s1.lastCheckpointChunk());
        assertEquals(List.of(2), s1.receivedChunks());

        // Arrive: chunk 0 next
        ChunkUploadResponse r0 = uploadService.saveChunk(fileId, 0, 3, fileName, totalSize, chunk0);
        assertFalse(r0.complete());

        // Contiguous checkpoint is now 0 (since 0 is present, 1 is missing)
        UploadStatusResponse s2 = uploadService.getUploadStatus(fileId);
        assertEquals(0, s2.lastCheckpointChunk());
        assertEquals(List.of(0, 2), s2.receivedChunks());

        // Arrive: chunk 1 (completes the puzzle)
        ChunkUploadResponse r1 = uploadService.saveChunk(fileId, 1, 3, fileName, totalSize, chunk1);
        assertTrue(r1.complete());

        Path assembledPath = uploadService.getAssembledFilePath(fileId).orElseThrow();
        byte[] assembledBytes = Files.readAllBytes(assembledPath);
        assertArrayEquals("PartAPartBPartC".getBytes(), assembledBytes);
    }

    @Test
    @DisplayName("Should sanitize fileId and fileNames preventing directory traversal")
    void testSanitization() throws IOException {
        String riskyId = "../../etc/passwd";
        String riskyName = "../../../malicious.sh";
        byte[] chunk = "echo hack".getBytes();

        ChunkUploadResponse resp = uploadService.saveChunk(riskyId, 0, 1, riskyName, chunk.length, chunk);
        assertTrue(resp.complete());

        UploadStatusResponse status = uploadService.getUploadStatus(riskyId);
        assertTrue(status.complete());
        // Clean ID should not contain '..'
        assertFalse(status.fileId().contains(".."));
    }
}
