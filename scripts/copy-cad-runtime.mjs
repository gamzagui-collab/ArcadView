import {
  copyFile,
  cp,
  mkdir,
  readFile,
  rm,
} from "node:fs/promises";
import { resolve } from "node:path";

const libreDwgPackageDirectory = resolve(
  "node_modules",
  "@mlightcad",
  "libredwg-web",
);
const libreDwgMetadata = JSON.parse(
  await readFile(
    resolve(libreDwgPackageDirectory, "package.json"),
    "utf8",
  ),
);

if (libreDwgMetadata.version !== "0.9.0") {
  throw new Error(
    `Expected @mlightcad/libredwg-web 0.9.0, found ${libreDwgMetadata.version}.`,
  );
}

const destinationDirectory = resolve("public", "wasm");
await mkdir(destinationDirectory, { recursive: true });

await Promise.all([
  copyFile(
    resolve(
      libreDwgPackageDirectory,
      "wasm",
      "libredwg-web.js",
    ),
    resolve(destinationDirectory, "libredwg-web.js"),
  ),
  copyFile(
    resolve(
      libreDwgPackageDirectory,
      "wasm",
      "libredwg-web.wasm",
    ),
    resolve(destinationDirectory, "libredwg-web.wasm"),
  ),
]);

const pdfPackageDirectory = resolve("node_modules", "pdfjs-dist");
const pdfDestination = resolve("public", "pdfjs");
await mkdir(pdfDestination, { recursive: true });
await Promise.all([
  copyFile(resolve(pdfPackageDirectory, "legacy", "build", "pdf.worker.min.mjs"), resolve(pdfDestination, "pdf.worker.min.mjs")),
  copyFile(resolve(pdfPackageDirectory, "LICENSE"), resolve(pdfDestination, "LICENSE")),
  ...["cmaps", "standard_fonts", "wasm", "iccs"].map((directory) =>
    cp(resolve(pdfPackageDirectory, directory), resolve(pdfDestination, directory), { recursive: true })),
  copyFile(resolve("node_modules", "libarchive-wasm", "dist", "libarchive.wasm"), resolve(destinationDirectory, "libarchive.wasm")),
]);

await Promise.all([
  rm(resolve(destinationDirectory, "libdxfrw-web.js"), { force: true }),
  rm(resolve(destinationDirectory, "libdxfrw.wasm"), { force: true }),
]);

const licenseDestinationDirectory = resolve("public", "licenses");
await mkdir(licenseDestinationDirectory, { recursive: true });

const distributableLicenseFiles = [
  "LICENSE",
  "LICENSE-APACHE-2.0.txt",
  "LICENSE-CAPACITOR-MIT.txt",
  "LICENSE-DXF-PARSER-MIT.txt",
  "LICENSE-FONT-OFL-1.1.txt",
  "LICENSE-NANUM-GOTHIC.txt",
  "LICENSE-CAD-SYMBOLS-OFL.txt",
  "LICENSE-FFLATE-MIT.txt",
  "LICENSE-PDFJS-THIRD-PARTY.txt",
  "LICENSE-LIBARCHIVE-WASM-MIT.txt",
  "LICENSE-LIBARCHIVE.txt",
  "LICENSE-LIBARCHIVE-SOURCE-NOTICES.txt",
  "LICENSE-OPENSSL-3.txt",
  "LICENSE-ZLIB.txt",
  "LICENSE-BZIP2.txt",
  "LICENSE-XZ-0BSD.txt",
  "LICENSE-EMSCRIPTEN.txt",
  "LICENSE-MUSL.txt",
  "LICENSE-LLVM.txt",
  "NOTICE-ARCHIVE-RUNTIME.md",
  "LICENSE-MPL-2.0.txt",
  "LICENSE-REACT-MIT.txt",
  "LICENSE-THREE-MIT.txt",
  "NOTICE.md",
  "THIRD_PARTY_LICENSES.md",
];

await Promise.all(
  distributableLicenseFiles.map((fileName) =>
    copyFile(
      resolve(fileName),
      resolve(licenseDestinationDirectory, fileName),
    ),
  ),
);

console.log(
  "Offline LibreDWG runtime and open-source notices copied to public assets.",
);
