package com.izcad.viewer;

/** Keep in sync with src/files/fileTypes.ts. Chunk sizes stay bounded. */
final class DrawingLimits {
    static final long SOURCE_BYTES = 512L * 1024 * 1024;
    static final long DXF_BYTES = 1024L * 1024 * 1024;
    static final long CONVERSION_TIMEOUT_MS = 10L * 60 * 1000;
    private DrawingLimits() { }
}
