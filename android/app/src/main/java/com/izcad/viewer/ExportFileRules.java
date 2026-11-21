package com.izcad.viewer;

import java.util.Locale;

/** Limits apply only to generated XLSX exports, never the original drawing. */
final class ExportFileRules {
    static final int MAX_BYTES = 16 * 1024 * 1024;
    static final int MAX_BASE64_CHARS = ((MAX_BYTES + 2) / 3) * 4;

    static String safeName(String requested) {
        if (requested == null || !requested.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            throw new IllegalArgumentException("An XLSX filename is required");
        }
        String name = requested.replaceAll("[\\p{Cntrl}\\\\/:*?\"<>|]", "_").trim();
        String stem = name.substring(0, name.length() - 5).replaceAll("^[. ]+|[. ]+$", "");
        if (stem.isEmpty()) stem = "물량집계";
        if (stem.length() > 170) stem = stem.substring(0, 170);
        return stem + ".xlsx";
    }

    static boolean validArchive(byte[] bytes) {
        return bytes != null && bytes.length >= 4 && bytes.length <= MAX_BYTES
            && bytes[0] == 'P' && bytes[1] == 'K' && bytes[2] == 3 && bytes[3] == 4;
    }
}
