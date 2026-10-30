package edu.unicompute.api.uploads;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class UploadService {

    private static final Logger log = LoggerFactory.getLogger(UploadService.class);
    private static final Pattern CHUNK_FILE_PATTERN = Pattern.compile("chunk_(\\d+)\\.part");

    private final Path storageDirectory;
    private final Path chunksDirectory;
    private final Path assembledDirectory;

    private final Map<String, UploadMetadata> activeUploads = new ConcurrentHashMap<>();

    public UploadService() {
        this(Paths.get(System.getProperty("java.io.tmpdir"), "unicompute_uploads"));
    }

    public UploadService(Path baseStoragePath) {
        this.storageDirectory = baseStoragePath;
        this.chunksDirectory = storageDirectory.resolve("chunks");
        this.assembledDirectory = storageDirectory.resolve("assembled");
        initDirectories();
    }

    private void initDirectories() {
        try {
            Files.createDirectories(chunksDirectory);
            Files.createDirectories(assembledDirectory);
        } catch (IOException e) {
            log.error("Failed to initialize upload directories at {}", storageDirectory, e);
        }
    }

    public String sanitizeId(String input) {
        if (input == null || input.isBlank()) {
            return "pkg-anon";
        }
        return input.replaceAll("[^a-zA-Z0-9_-]", "_");
    }

    public String sanitizeFileName(String input) {
        if (input == null || input.isBlank()) {
            return "workload.zip";
        }
        String name = new File(input).getName().replace("..", "_");
        return name.replaceAll("[^a-zA-Z0-9_.-]", "_");
    }

    public synchronized ChunkUploadResponse saveChunk(
            String fileId,
            int chunkIndex,
            int totalChunks,
            String fileName,
            long totalSize,
            byte[] bytes
    ) throws IOException {
        String cleanId = sanitizeId(fileId);
        String cleanName = sanitizeFileName(fileName);

        if (totalChunks < 1) {
            throw new IllegalArgumentException("totalChunks must be at least 1");
        }
        if (chunkIndex < 0 || chunkIndex >= totalChunks) {
            throw new IllegalArgumentException("chunkIndex " + chunkIndex + " is out of bounds (0 to " + (totalChunks - 1) + ")");
        }

        Path jobChunkDir = chunksDirectory.resolve(cleanId);
        Files.createDirectories(jobChunkDir);

        Path chunkFile = jobChunkDir.resolve(String.format("chunk_%05d.part", chunkIndex));
        Files.write(chunkFile, bytes != null ? bytes : new byte[0],
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);

        UploadMetadata meta = activeUploads.computeIfAbsent(cleanId, id ->
                new UploadMetadata(cleanId, cleanName, totalChunks, totalSize));
        meta.recordChunk(chunkIndex, bytes != null ? bytes.length : 0);

        // Check if all chunks received
        if (meta.getUploadedChunks().size() == totalChunks) {
            Path assembledPath = assembleFile(cleanId, meta);
            meta.setComplete(true);
            meta.setAssembledPath(assembledPath.toAbsolutePath().toString());

            log.info("Successfully assembled file package '{}' ({} chunks, {} bytes)",
                    cleanName, totalChunks, meta.getBytesUploaded());

            return new ChunkUploadResponse(
                    cleanId,
                    chunkIndex,
                    totalChunks,
                    meta.getUploadedChunks().size(),
                    meta.getBytesUploaded(),
                    true,
                    meta.getAssembledPath(),
                    "All " + totalChunks + " chunks received and assembled."
            );
        }

        return new ChunkUploadResponse(
                cleanId,
                chunkIndex,
                totalChunks,
                meta.getUploadedChunks().size(),
                meta.getBytesUploaded(),
                false,
                null,
                "Chunk " + chunkIndex + " of " + totalChunks + " saved."
        );
    }

    private Path assembleFile(String fileId, UploadMetadata meta) throws IOException {
        Files.createDirectories(assembledDirectory);
        Path assembledFile = assembledDirectory.resolve(fileId + "_" + meta.getFileName());
        Path jobChunkDir = chunksDirectory.resolve(fileId);

        try (OutputStream out = new BufferedOutputStream(Files.newOutputStream(
                assembledFile, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE))) {

            for (int i = 0; i < meta.getTotalChunks(); i++) {
                Path part = jobChunkDir.resolve(String.format("chunk_%05d.part", i));
                if (!Files.exists(part)) {
                    throw new IllegalStateException("Cannot assemble file; missing chunk " + i);
                }
                Files.copy(part, out);
            }
        }

        // Clean up chunk files
        try (Stream<Path> stream = Files.list(jobChunkDir)) {
            stream.forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {}
            });
        }
        try {
            Files.deleteIfExists(jobChunkDir);
        } catch (IOException ignored) {}

        return assembledFile;
    }

    public UploadStatusResponse getUploadStatus(String fileId) {
        String cleanId = sanitizeId(fileId);
        UploadMetadata meta = activeUploads.get(cleanId);
        if (meta != null) {
            List<Integer> sorted = meta.getSortedUploadedChunks();
            int lastCheckpoint = meta.computeContiguousCheckpoint();
            return new UploadStatusResponse(
                    cleanId,
                    meta.getFileName(),
                    meta.getTotalChunks(),
                    sorted.size(),
                    sorted,
                    lastCheckpoint,
                    meta.getBytesUploaded(),
                    meta.getTotalSize(),
                    meta.isComplete(),
                    meta.getAssembledPath()
            );
        }

        // Recover from disk if memory cache doesn't hold it
        return recoverFromDisk(cleanId);
    }

    private UploadStatusResponse recoverFromDisk(String cleanId) {
        // Check assembled directory
        if (Files.exists(assembledDirectory)) {
            try (Stream<Path> stream = Files.list(assembledDirectory)) {
                Optional<Path> found = stream
                        .filter(p -> p.getFileName().toString().startsWith(cleanId + "_"))
                        .findFirst();
                if (found.isPresent()) {
                    Path file = found.get();
                    long size = Files.size(file);
                    return new UploadStatusResponse(
                            cleanId,
                            file.getFileName().toString().substring(cleanId.length() + 1),
                            1,
                            1,
                            List.of(0),
                            0,
                            size,
                            size,
                            true,
                            file.toAbsolutePath().toString()
                    );
                }
            } catch (IOException ignored) {}
        }

        // Check chunks directory
        Path jobChunkDir = chunksDirectory.resolve(cleanId);
        if (Files.exists(jobChunkDir)) {
            List<Integer> parts = new ArrayList<>();
            long totalBytes = 0;
            try (Stream<Path> stream = Files.list(jobChunkDir)) {
                List<Path> files = stream.toList();
                for (Path p : files) {
                    Matcher m = CHUNK_FILE_PATTERN.matcher(p.getFileName().toString());
                    if (m.matches()) {
                        parts.add(Integer.parseInt(m.group(1)));
                        totalBytes += Files.size(p);
                    }
                }
            } catch (IOException ignored) {}

            Collections.sort(parts);
            int lastContiguous = -1;
            for (int i = 0; i < parts.size(); i++) {
                if (parts.get(i) == i) {
                    lastContiguous = i;
                } else {
                    break;
                }
            }

            return new UploadStatusResponse(
                    cleanId,
                    "recovered-upload",
                    parts.isEmpty() ? 0 : parts.get(parts.size() - 1) + 1,
                    parts.size(),
                    parts,
                    lastContiguous,
                    totalBytes,
                    totalBytes,
                    false,
                    null
            );
        }

        // Not found
        return new UploadStatusResponse(
                cleanId,
                "",
                0,
                0,
                List.of(),
                -1,
                0,
                0,
                false,
                null
        );
    }

    public Optional<String> getAssembledFileDataUrl(String fileId) {
        String cleanId = sanitizeId(fileId);
        Optional<Path> path = getAssembledFilePath(cleanId);
        if (path.isEmpty()) {
            return Optional.empty();
        }
        try {
            byte[] bytes = Files.readAllBytes(path.get());
            String b64 = Base64.getEncoder().encodeToString(bytes);
            String mime = path.get().getFileName().toString().toLowerCase().endsWith(".zip")
                    ? "application/zip"
                    : "application/octet-stream";
            return Optional.of("data:" + mime + ";base64," + b64);
        } catch (IOException e) {
            log.error("Failed to read assembled file bytes for {}", cleanId, e);
            return Optional.empty();
        }
    }

    public Optional<Path> getAssembledFilePath(String fileId) {
        String cleanId = sanitizeId(fileId);
        UploadMetadata meta = activeUploads.get(cleanId);
        if (meta != null && meta.getAssembledPath() != null) {
            Path p = Paths.get(meta.getAssembledPath());
            if (Files.exists(p)) {
                return Optional.of(p);
            }
        }

        if (Files.exists(assembledDirectory)) {
            try (Stream<Path> stream = Files.list(assembledDirectory)) {
                return stream
                        .filter(p -> p.getFileName().toString().startsWith(cleanId + "_"))
                        .findFirst();
            } catch (IOException ignored) {}
        }
        return Optional.empty();
    }

    public void clearAllUploads() {
        activeUploads.clear();
        deleteDirectoryRecursively(chunksDirectory);
        deleteDirectoryRecursively(assembledDirectory);
        initDirectories();
    }

    private void deleteDirectoryRecursively(Path dir) {
        if (!Files.exists(dir)) return;
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Collections.reverseOrder())
                .forEach(p -> {
                    try {
                        Files.deleteIfExists(p);
                    } catch (IOException ignored) {}
                });
        } catch (IOException ignored) {}
    }

    public static class UploadMetadata {
        private final String fileId;
        private final String fileName;
        private final int totalChunks;
        private final long totalSize;
        private final Set<Integer> uploadedChunks = ConcurrentHashMap.newKeySet();
        private volatile long bytesUploaded = 0;
        private volatile boolean complete = false;
        private volatile String assembledPath = null;

        public UploadMetadata(String fileId, String fileName, int totalChunks, long totalSize) {
            this.fileId = fileId;
            this.fileName = fileName;
            this.totalChunks = totalChunks;
            this.totalSize = totalSize;
        }

        public synchronized void recordChunk(int index, long size) {
            if (uploadedChunks.add(index)) {
                bytesUploaded += size;
            }
        }

        public int computeContiguousCheckpoint() {
            List<Integer> sorted = getSortedUploadedChunks();
            int contig = -1;
            for (int i = 0; i < sorted.size(); i++) {
                if (sorted.get(i) == i) {
                    contig = i;
                } else {
                    break;
                }
            }
            return contig;
        }

        public List<Integer> getSortedUploadedChunks() {
            List<Integer> list = new ArrayList<>(uploadedChunks);
            Collections.sort(list);
            return list;
        }

        public String getFileId() { return fileId; }
        public String getFileName() { return fileName; }
        public int getTotalChunks() { return totalChunks; }
        public long getTotalSize() { return totalSize; }
        public Set<Integer> getUploadedChunks() { return uploadedChunks; }
        public long getBytesUploaded() { return bytesUploaded; }
        public boolean isComplete() { return complete; }
        public void setComplete(boolean complete) { this.complete = complete; }
        public String getAssembledPath() { return assembledPath; }
        public void setAssembledPath(String assembledPath) { this.assembledPath = assembledPath; }
    }
}
