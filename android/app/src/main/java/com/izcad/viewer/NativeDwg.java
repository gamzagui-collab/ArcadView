package com.izcad.viewer;

/** Loaded only by the disposable conversion service, never the viewer. */
final class NativeDwg {
    private static final boolean AVAILABLE;
    static {
        boolean available;
        try { System.loadLibrary("arcad_dwg"); available = true; }
        catch (UnsatisfiedLinkError error) { available = false; }
        AVAILABLE = available;
    }
    static boolean available() { return AVAILABLE; }
    static native int convertFiles(String input, String output, String metadata);
    private NativeDwg() { }
}
