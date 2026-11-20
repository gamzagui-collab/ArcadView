package com.izcad.viewer;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Keep every model/paper entity and its transitive block definitions. Copy
 * original byte ranges; only unused BLOCKS definitions are omitted. */
final class DxfBlockPruner {
    private static final class Block {
        long start, end;
        String name;
        final Set<String> references = new HashSet<>();
    }
    static final class Result {
        final int total, retained;
        Result(int total, int retained) { this.total = total; this.retained = retained; }
    }
    private static final class Lines implements AutoCloseable {
        final InputStream in;
        long position;
        int buffered = -1;
        Lines(File file) throws IOException { in = new BufferedInputStream(new FileInputStream(file), 256 * 1024); }
        byte[] next() throws IOException {
            ByteArrayOutputStream out = new ByteArrayOutputStream(64);
            int b = buffered >= 0 ? buffered : in.read(); buffered = -1;
            if (b < 0) return null;
            for (;;) {
                position++;
                if (b == 10) break;
                if (b == 13) { int n = in.read(); if (n == 10) position++; else buffered = n; break; }
                out.write(b);
                b = in.read(); if (b < 0) break;
            }
            return out.toByteArray();
        }
        public void close() throws IOException { in.close(); }
    }
    static Result prune(File input, File output) throws IOException {
        List<Block> blocks = new ArrayList<>();
        Map<String, List<Block>> byName = new HashMap<>();
        Set<String> roots = new HashSet<>();
        String section = "", record = "";
        Block current = null;
        boolean endBlock = false, eof = false;
        try (Lines lines = new Lines(input)) {
            for (;;) {
                long start = lines.position;
                byte[] codeLine = lines.next(); if (codeLine == null) break;
                byte[] valueLine = lines.next(); if (valueLine == null) throw new IOException("Truncated DXF pair");
                int code;
                try { code = Integer.parseInt(new String(codeLine, StandardCharsets.US_ASCII).trim()); }
                catch (NumberFormatException e) { throw new IOException("Invalid DXF group code", e); }
                // Only group 0/2 strings matter to reachability. No entity values are changed.
                if (code != 0 && code != 2) continue;
                String value = new String(valueLine, StandardCharsets.UTF_8).trim();
                if (code == 0) {
                    if (endBlock) {
                        current.end = start;
                        if (current.name == null) throw new IOException("Missing block name");
                        // Some exports contain repeated names. Preserve every definition
                        // and the union of their dependencies, leaving parser precedence intact.
                        byName.computeIfAbsent(current.name, key -> new ArrayList<>()).add(current);
                        blocks.add(current); current = null; endBlock = false;
                    }
                    record = value;
                    if (value.equals("ENDSEC")) section = "";
                    if (value.equals("EOF")) eof = true;
                    if (section.equals("BLOCKS") && value.equals("BLOCK")) {
                        if (current != null) throw new IOException("Nested DXF block record");
                        current = new Block(); current.start = start;
                    } else if (current != null && value.equals("ENDBLK")) endBlock = true;
                } else if (record.equals("SECTION")) section = value;
                else if (current != null) {
                    if (record.equals("BLOCK")) current.name = value;
                    else if (!record.equals("ENDBLK")) current.references.add(value);
                } else if (section.equals("ENTITIES")) roots.add(value);
            }
        }
        if (!eof || current != null) throw new IOException("Incomplete DXF document");
        Set<String> needed = new HashSet<>();
        ArrayDeque<String> queue = new ArrayDeque<>(roots);
        // Model/paper block roots may carry entities in BLOCKS in older exports.
        for (String name : byName.keySet()) if (name.toUpperCase(Locale.ROOT).startsWith("*MODEL_SPACE") || name.toUpperCase(Locale.ROOT).startsWith("*PAPER_SPACE")) queue.add(name);
        while (!queue.isEmpty()) {
            String name = queue.removeFirst();
            if (!needed.add(name)) continue;
            List<Block> definitions = byName.get(name);
            if (definitions != null) for (Block block : definitions) queue.addAll(block.references);
        }
        int retained = 0;
        try (RandomAccessFile source = new RandomAccessFile(input, "r"); OutputStream target = new BufferedOutputStream(new FileOutputStream(output), 256 * 1024)) {
            long copied = 0;
            byte[] buffer = new byte[256 * 1024];
            for (Block block : blocks) {
                if (needed.contains(block.name)) { retained++; continue; }
                copy(source, target, copied, block.start, buffer); copied = block.end;
            }
            copy(source, target, copied, source.length(), buffer);
        }
        return new Result(blocks.size(), retained);
    }
    private static void copy(RandomAccessFile input, OutputStream output, long start, long end, byte[] buffer) throws IOException {
        input.seek(start);
        for (long left = end - start; left > 0;) {
            int n = input.read(buffer, 0, (int)Math.min(left, buffer.length));
            if (n < 0) throw new EOFException(); output.write(buffer, 0, n); left -= n;
        }
    }
    private DxfBlockPruner() { }
}
