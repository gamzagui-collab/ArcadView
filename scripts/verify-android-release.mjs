import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { elf16kAligned, zipDataOffset } from "./native-library-check.mjs";

const args = process.argv.slice(2);
const archivePath = resolve(args.find((arg) => !arg.startsWith("--")) ?? "android/app/build/outputs/bundle/release/app-release.aab");
const extension = extname(archivePath).toLowerCase();
const isBundle = extension === ".aab";
const checks = [];
const check = (name, passed, detail = "") => checks.push({ name, passed, detail });
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

// Read ZIP directory records directly: no extraction, extra dependencies, or access to signing keys.
function zipEntries(bytes) {
  let end = bytes.length - 22;
  const minimum = Math.max(0, bytes.length - 22 - 65535);
  for (; end >= minimum; end--) {
    if (bytes.readUInt32LE(end) === 0x06054b50 && end + 22 + bytes.readUInt16LE(end + 20) === bytes.length) break;
  }
  if (end < minimum) throw new Error("The artifact is not a readable ZIP archive.");
  const count = bytes.readUInt16LE(end + 10);
  let cursor = bytes.readUInt32LE(end + 16);
  if (count === 65535 || cursor === 0xffffffff) throw new Error("ZIP64 artifacts are not supported by this verifier.");
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid ZIP directory record.");
    const method = bytes.readUInt16LE(cursor + 10);
    const compressed = bytes.readUInt32LE(cursor + 20);
    const uncompressed = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const offset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (entries.has(name)) throw new Error("The artifact contains duplicate ZIP entries.");
    entries.set(name, { method, compressed, uncompressed, offset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function entryBytes(archive, entry) {
  if (archive.readUInt32LE(entry.offset) !== 0x04034b50) throw new Error("Invalid ZIP local record.");
  const start = entry.offset + 30 + archive.readUInt16LE(entry.offset + 26) + archive.readUInt16LE(entry.offset + 28);
  const compressed = archive.subarray(start, start + entry.compressed);
  const bytes = entry.method === 0 ? compressed : entry.method === 8 ? inflateRawSync(compressed, { maxOutputLength: entry.uncompressed + 1 }) : null;
  if (bytes == null || bytes.length !== entry.uncompressed) throw new Error("Unsupported or damaged ZIP entry.");
  return bytes;
}

async function filesWithin(root) {
  const nested = await Promise.all((await readdir(root, { withFileTypes: true })).map((item) => {
    const path = resolve(root, item.name);
    return item.isDirectory() ? filesWithin(path) : item.isFile() ? [path] : [];
  }));
  return nested.flat();
}

try {
  if (![".apk", ".aab"].includes(extension)) throw new Error("Provide an APK or AAB artifact path.");
  if (args.includes("--require-signed") && !isBundle) {
    throw new Error("--require-signed verifies AAB signing only. Verify APK signatures with the Android SDK apksigner tool.");
  }
  const archive = await readFile(archivePath);
  const entries = zipEntries(archive);
  const prefix = isBundle ? "base/assets/public/" : "assets/public/";
  check("Artifact contains an Android manifest and application bytecode",
    entries.has(isBundle ? "base/manifest/AndroidManifest.xml" : "AndroidManifest.xml") &&
    [...entries.keys()].some((name) => isBundle ? /^base\/dex\/classes\d*\.dex$/.test(name) : /^classes\d*\.dex$/.test(name)));
  check("Android artifact contains the local web application", entries.has(`${prefix}index.html`));
  const distRoot = resolve("dist");
  const mismatches = [];
  for (const file of await filesWithin(distRoot)) {
    const name = relative(distRoot, file).replaceAll("\\", "/");
    const entry = entries.get(`${prefix}${name}`);
    if (!entry || sha256(await readFile(file)) !== sha256(entryBytes(archive, entry))) mismatches.push(name);
  }
  check("Artifact assets match the current production build", mismatches.length === 0, mismatches.slice(0, 8).join(", "));
  check("Artifact omits JavaScript source maps", ![...entries.keys()].some((name) => name.endsWith(".map")));
  check("Artifact includes the offline DWG runtime", entries.has(`${prefix}wasm/libredwg-web.js`) && entries.has(`${prefix}wasm/libredwg-web.wasm`));
  check("Artifact includes local font and license notices", entries.has(`${prefix}fonts/IzCadSans-Regular.ttf`) && entries.has(`${prefix}licenses/NOTICE.md`) && entries.has(`${prefix}licenses/THIRD_PARTY_LICENSES.md`));
  const nativeLibraries = [...entries.keys()].filter((name) => /(?:^|\/)lib\/[^/]+\/[^/]+\.so$/.test(name));
  check("Native DWG converter includes all supported Android ABIs",["arm64-v8a","armeabi-v7a","x86_64","x86"].every(abi=>entries.has(`${isBundle?'base/':''}lib/${abi}/libarcad_dwg.so`)));
  check("Native libraries use 16 KB ELF segment alignment",nativeLibraries.length>0&&nativeLibraries.every(name=>elf16kAligned(entryBytes(archive,entries.get(name)))));
  if(!isBundle)check("Uncompressed native libraries are 16 KB ZIP aligned",nativeLibraries.every(name=>{const entry=entries.get(name);return entry.method===0&&zipDataOffset(archive,entry)%16384===0;}));

  if (isBundle) {
    const signatureEntries = [...entries.keys()].filter((name) => /^META-INF\/[^/]+\.(?:RSA|DSA|EC)$/.test(name));
    if (signatureEntries.length) {
      const javaHome = process.env.JAVA_HOME;
      const jarSigner = javaHome ? resolve(javaHome, "bin", process.platform === "win32" ? "jarsigner.exe" : "jarsigner") : "jarsigner";
      const signature = spawnSync(jarSigner, ["-verify", archivePath], { encoding: "utf8", windowsHide: true });
      check("AAB cryptographic signature", signature.status === 0 && /jar verified/i.test(signature.stdout ?? "") &&
        !/contains unsigned entries/i.test(`${signature.stdout ?? ""}${signature.stderr ?? ""}`),
        "Run jarsigner -verify on the final signed bundle; verification output is intentionally not printed.");
    } else {
      console.log("INFO  Bundle is unsigned. Sign with the existing Play upload key before uploading.");
      if (args.includes("--require-signed")) check("Signed Play upload bundle", false, "The final Play bundle must be signed with the existing upload key.");
    }
  }
  console.log(`Artifact: ${archivePath}`);
  console.log(`SHA-256: ${sha256(archive)}`);
  for (const result of checks) {
    console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.name}`);
    if (!result.passed && result.detail) console.log(`      ${result.detail}`);
  }
  if (checks.some((result) => !result.passed)) process.exitCode = 1;
  else console.log("Artifact checks passed. Play Console validation and real-device testing are still required before rollout.");
} catch (error) {
  console.error(`FAIL  ${error instanceof Error ? error.message : "Release verification failed."}`);
  process.exitCode = 1;
}
