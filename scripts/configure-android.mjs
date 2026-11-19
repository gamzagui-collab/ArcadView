import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const variablesPath = resolve("android", "variables.gradle");
const manifestPath = resolve("android", "app", "src", "main", "AndroidManifest.xml");
const gradlePath = resolve("android", "app", "build.gradle");

function replaceRequired(source, pattern, replacement, description) {
  if (!pattern.test(source)) {
    throw new Error(`Could not configure ${description}. Check the Android source project.`);
  }
  return source.replace(pattern, replacement);
}

let variables = await readFile(variablesPath, "utf8");
for (const [setting, value] of [
  ["minSdkVersion", 26],
  ["compileSdkVersion", 36],
  ["targetSdkVersion", 36],
]) {
  variables = replaceRequired(
    variables,
    new RegExp(`${setting}\\s*=\\s*\\d+`),
    `${setting} = ${value}`,
    setting,
  );
}

let manifest = await readFile(manifestPath, "utf8");
// File access uses user-selected URI grants, not network or shared-storage permissions.
manifest = manifest.replace(
  /\s*<uses-permission\s+android:name="android\.permission\.(?:INTERNET|ACCESS_NETWORK_STATE|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_[A-Z_]+)"[^>]*\/?>/g,
  "",
);
manifest = replaceRequired(manifest, /<application\b[^>]*>/, (tag) => {
  const attributes = {
    usesCleartextTraffic: "false",
    allowBackup: "false",
    fullBackupContent: "@xml/backup_rules",
    dataExtractionRules: "@xml/data_extraction_rules",
    enableOnBackInvokedCallback: "true",
  };
  for (const [name, value] of Object.entries(attributes)) {
    const pattern = new RegExp(`\\s+android:${name}="[^"]*"`, "g");
    tag = tag.replace(pattern, "");
    tag = tag.replace(/>$/, `\n        android:${name}="${value}">`);
  }
  return tag;
}, "offline application manifest");

let gradle = await readFile(gradlePath, "utf8");
gradle = replaceRequired(gradle, /versionName\s+(?:"[^"]+"|appMetadata\.version)/, 'versionName appMetadata.version', "Android version name from package metadata");
// Existing builds keep their release-code override and optional signing settings.
gradle = gradle.replace(/versionCode\s+([0-3])\b/, "versionCode 4");

await writeFile(variablesPath, variables, "utf8");
await writeFile(manifestPath, manifest, "utf8");
await writeFile(gradlePath, gradle, "utf8");
console.log("Android configured: API 26+, target/compile API 36, offline permissions, private library backup disabled.");
