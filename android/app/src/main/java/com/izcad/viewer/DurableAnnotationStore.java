package com.izcad.viewer;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;

/** App-private, drawing-keyed snapshots. sync precedes atomic replacement;
 * interrupted pending files are never treated as completed documents. */
final class DurableAnnotationStore {
    private static final int MAX_BYTES = 16 * 1024 * 1024;
    private final File directory;
    DurableAnnotationStore(File directory) { this.directory = directory; }
    private File path(String key, String extension) throws Exception {
        if (key == null || key.isEmpty() || key.length() > 512) throw new IOException("Invalid drawing key");
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
        StringBuilder name = new StringBuilder();
        for (byte b : digest) name.append(String.format("%02x", b & 255));
        return new File(directory, name + extension);
    }
    synchronized String read(String key) throws Exception {
        File target = path(key, ".json");
        if (!target.exists()) return null;
        if (!target.isFile() || target.length() > MAX_BYTES) throw new IOException("Invalid annotation snapshot");
        return new String(Files.readAllBytes(target.toPath()), StandardCharsets.UTF_8);
    }
    synchronized void write(String key, String json) throws Exception {
        if (json == null || json.length() > 4_000_000) throw new IOException("Annotation size exceeded");
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) throw new IOException("Annotation size exceeded");
        File target = path(key, ".json"), pending = path(key, ".pending");
        Files.createDirectories(directory.toPath());
        try {
            try (FileOutputStream stream = new FileOutputStream(pending)) {
                stream.write(bytes);
                stream.flush();
                stream.getFD().sync();
            }
            Files.move(pending.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception failure) {
            try { Files.deleteIfExists(pending.toPath()); } catch (Exception ignored) { }
            throw failure;
        }
    }
}
