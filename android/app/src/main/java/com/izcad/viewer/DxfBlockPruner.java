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
        final byte[] buffer = new byte[256 * 1024];
        byte[] value = new byte[128];
        int cursor, limit, length, group;
        long position;
        Lines(File file) throws IOException { in = new FileInputStream(file); }
        private boolean available() throws IOException {
            if (cursor < limit) return true;
            limit = in.read(buffer); cursor = 0;
            return limit > 0;
        }
        // Scan buffered byte ranges. Numeric/coordinate values are skipped without
        // allocating a line, String or per-byte synchronized stream operation.
        int next(boolean capture) throws IOException {
            length = 0; boolean present = false;
            while (available()) {
                int start = cursor;
                while (cursor < limit && buffer[cursor] != 10 && buffer[cursor] != 13) cursor++;
                int count = cursor - start;
                if (capture) {
                    if (length + count > value.length) value = Arrays.copyOf(value, Math.max(length + count, value.length * 2));
                    System.arraycopy(buffer, start, value, length, count);
                }
                length += count; position += count; present = true;
                if (cursor < limit) {
                    int newline = buffer[cursor++]; position++;
                    if (newline == 13 && available() && buffer[cursor] == 10) { cursor++; position++; }
                    return length;
                }
            }
            return present ? length : -1;
        }
        boolean nextCode() throws IOException {
            if (next(true) < 0) return false;
            int start = 0, end = length;
            while (start < end && (value[start] & 255) <= 32) start++;
            while (end > start && (value[end - 1] & 255) <= 32) end--;
            boolean negative = start < end && value[start] == '-';
            if (start < end && (negative || value[start] == '+')) start++;
            if (start == end) throw new IOException("Invalid DXF group code");
            long number = 0, maximum = negative ? 2147483648L : Integer.MAX_VALUE;
            for (int i = start; i < end; i++) {
                int digit = value[i] - '0';
                if (digit < 0 || digit > 9 || (number = number * 10 + digit) > maximum) throw new IOException("Invalid DXF group code");
            }
            group = (int)(negative ? -number : number);
            return true;
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
                if (!lines.nextCode()) break;
                int code = lines.group;
                if (lines.next(code == 0 || code == 2) < 0) throw new IOException("Truncated DXF pair");
                // Only group 0/2 strings matter to reachability. No entity values are changed.
                if (code != 0 && code != 2) continue;
                String value = new String(lines.value, 0, lines.length, StandardCharsets.UTF_8).trim();
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
