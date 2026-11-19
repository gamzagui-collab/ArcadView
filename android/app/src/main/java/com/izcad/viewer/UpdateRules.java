package com.izcad.viewer;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure validation rules shared by native update discovery and its JVM tests. */
final class UpdateRules {
    static final String REPOSITORY = "https://github.com/gamzagui-collab/ArcadView";
    static final String LATEST = "https://api.github.com/repos/gamzagui-collab/ArcadView/releases/latest";
    static final long MAX_APK_BYTES = 128L * 1024 * 1024;
    private static final Pattern NAME = Pattern.compile("Arcad-View-v([0-9]+\\.[0-9]+\\.[0-9]+)-([1-9][0-9]{0,9})\\.apk");

    static long versionCode(String tag, String name, String url, String digest, long size) {
        if (tag == null || name == null || url == null || digest == null || size <= 0 || size > MAX_APK_BYTES) return -1;
        Matcher m = NAME.matcher(name);
        if (!m.matches() || !tag.equals("v" + m.group(1)) || !url.equals(REPOSITORY + "/releases/download/" + tag + "/" + name)
            || !digest.matches("sha256:[0-9a-fA-F]{64}")) return -1;
        long code = Long.parseLong(m.group(2));
        return code <= 2100000000 ? code : -1;
    }

    static boolean downloadHost(String url) {
        try {
            URI uri = new URI(url); String host = uri.getHost();
            return "https".equals(uri.getScheme()) && uri.getRawUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443)
                && ("github.com".equals(host) || "release-assets.githubusercontent.com".equals(host)
                || "objects.githubusercontent.com".equals(host) || "github-releases.githubusercontent.com".equals(host));
        } catch (Exception error) { return false; }
    }
}
