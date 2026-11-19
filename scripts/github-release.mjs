import { readFile, writeFile, mkdir, readdir, appendFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const requireValue = (value, message) => { if (!value) throw new Error(message); };
export class HttpError extends Error {
  constructor(status, path) { super(`GitHub HTTP ${status}: ${path}`); this.status = status; }
}
export class GitHubApi {
  constructor(token, { fetchImpl = fetch, wait = sleep } = {}) { this.token = token; this.fetch = fetchImpl; this.wait = wait; }
  async request(method, address, { json, bytes, binary = false, retry404 = false, allow404 = false } = {}) {
    const url = new URL(address.startsWith("https:") ? address : `https://api.github.com${address}`);
    requireValue(["api.github.com", "uploads.github.com"].includes(url.hostname) && url.protocol === "https:", "Unexpected authenticated GitHub host");
    for (let attempt = 0; ; attempt++) {
      const headers = { Authorization: `Bearer ${this.token}`, Accept: binary ? "application/octet-stream" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Arcad-View-release", "Cache-Control": "no-cache" };
      if (json !== undefined || bytes) headers["Content-Type"] = bytes ? "application/octet-stream" : "application/json";
      let response;
      try {
        response = await this.fetch(url.href, { method, headers, body: bytes ?? (json === undefined ? undefined : JSON.stringify(json)), redirect: "manual", signal: AbortSignal.timeout(45000) });
      } catch {
        if (method !== "GET" || attempt >= 4) throw new HttpError(0, url.pathname);
      }
      if (response?.status === 404 && allow404) return null;
      if (response && binary && [301, 302, 303, 307, 308].includes(response.status)) {
        // Draft downloads can redirect to a signed CDN URL. Never forward the token.
        let next = response.headers.get("location");
        for (let redirect = 0; redirect < 5; redirect++) {
          const target = new URL(next);
          requireValue(target.protocol === "https:" && !target.username && !target.password && (!target.port || target.port === "443") && ["github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(target.hostname), "Unexpected release download redirect");
          response = await this.fetch(target.href, { redirect: "manual", signal: AbortSignal.timeout(45000) });
          if (![301, 302, 303, 307, 308].includes(response.status)) break;
          next = response.headers.get("location");
        }
      }
      if (response?.ok) {
        try {
          if (!binary) return response.status === 204 ? null : await response.json();
          const chunks = []; let size = 0;
          for await (const part of response.body) { size += part.length; requireValue(size <= 128 * 1024 * 1024, "Release asset exceeds size limit"); chunks.push(part); }
          return Buffer.concat(chunks);
        } catch (error) {
          if (error.message === "Release asset exceeds size limit") throw error;
          if (method !== "GET" || attempt >= 4) throw new HttpError(0, url.pathname);
          await this.wait(Math.min(10000, 1000 * 2 ** attempt)); continue;
        }
      }
      const status = response?.status ?? 0;
      const transient = status === 0 || status === 429 || status >= 500 || (status === 404 && retry404);
      // POST is reconciled by the publisher, since a lost reply may have created it.
      if (!transient || method === "POST" || attempt >= 4) throw new HttpError(status, url.pathname);
      await this.wait(Math.min(10000, 1000 * 2 ** attempt));
    }
  }
}

export class ReleasePublisher {
  constructor(api, config, { wait = sleep, log = console.log } = {}) {
    this.api = api; this.config = config; this.wait = wait; this.log = log;
    const { repository, tag, version, code, commit } = config;
    requireValue(/^[\w.-]+\/[\w.-]+$/.test(repository) && /^v\d+\.\d+\.\d+$/.test(tag) && tag === `v${version}` && Number.isSafeInteger(code) && code > 0 && /^[a-f0-9]{40}$/.test(commit), "Invalid release identity");
    this.base = `/repos/${repository}`;
    this.names = ["release-info.json", "SHA256SUMS.txt", `Arcad-View-${tag}-${code}.apk`, `Arcad-View-${tag}-source.zip`];
  }
  validateRelease(release) {
    requireValue(Number.isSafeInteger(release?.id) && release.id > 0 && release.tag_name === this.config.tag && !release.prerelease, "Unexpected release identity");
    return release;
  }
  async findRelease() {
    const byTag = await this.api.request("GET", `${this.base}/releases/tags/${this.config.tag}`, { allow404: true });
    if (byTag) return this.validateRelease(byTag);
    // Used only for an existing draft at preflight/recovery, never to rediscover
    // a draft after a successful creation response.
    let found;
    for (let page = 1; page <= 100; page++) {
      const rows = await this.api.request("GET", `${this.base}/releases?per_page=100&page=${page}`);
      for (const row of rows.filter(r => r.tag_name === this.config.tag)) { requireValue(!found, "Multiple releases have this tag; no changes made"); found = row; }
      if (rows.length < 100) return found ? this.validateRelease(found) : null;
    }
    throw new Error("Release lookup exceeded pagination limit");
  }
  async assets(id) {
    const rows = await this.api.request("GET", `${this.base}/releases/${id}/assets?per_page=100`, { retry404: true });
    requireValue(rows.length <= this.names.length && rows.every(a => this.names.includes(a.name)) && new Set(rows.map(a => a.name)).size === rows.length, "Unexpected or duplicate release assets; no files replaced");
    return rows;
  }
  validateFiles(files) {
    requireValue(files.size === this.names.length && this.names.every(n => files.has(n)), "Expected exactly the four release files");
    const metadata = JSON.parse(files.get("release-info.json").toString("utf8"));
    const { tag, version, code, commit, certificate } = this.config;
    requireValue(metadata.tag === tag && metadata.versionName === version && metadata.versionCode === code && metadata.commit === commit && metadata.packageId === "com.izcad.viewer" && metadata.signingCertSha256 === certificate, "Source commit, application or signer metadata mismatch");
    const sums = this.names.slice(2).map(n => `${hash(files.get(n))}  ${n}`);
    requireValue(files.get("SHA256SUMS.txt").toString("utf8") === sums.join("\n") + "\n" && JSON.stringify(metadata.assets) === JSON.stringify(sums), "APK/source checksums disagree with release metadata");
    return new Map(this.names.map(name => [name, { name, bytes: files.get(name), size: files.get(name).length, digest: `sha256:${hash(files.get(name))}` }]));
  }
  matches(asset, file) { return asset.state === "uploaded" && asset.size === file.size && asset.digest === file.digest; }
  async downloadVerified(release) {
    const assets = await this.assets(release.id);
    requireValue(assets.length === this.names.length, "Incomplete release assets");
    const files = new Map();
    for (const asset of assets) {
      requireValue(asset.state === "uploaded" && asset.size > 0 && asset.size <= 128 * 1024 * 1024 && /^sha256:[a-f0-9]{64}$/.test(asset.digest), "Release asset has no valid digest");
      const bytes = await this.api.request("GET", `${this.base}/releases/assets/${asset.id}`, { binary: true, retry404: true });
      requireValue(bytes.length === asset.size && `sha256:${hash(bytes)}` === asset.digest, `Downloaded asset checksum mismatch: ${asset.name}`);
      files.set(asset.name, bytes);
    }
    this.validateFiles(files); return files;
  }
  async inspect() {
    const release = await this.findRelease();
    const assets = release ? await this.assets(release.id) : [];
    if (assets.length === this.names.length && assets.every(a => a.state === "uploaded" && a.digest)) {
      return { mode: release.draft ? "draft" : "published", releaseId: release.id, files: await this.downloadVerified(release) };
    }
    requireValue(!release || release.draft, "Published release is incomplete; no files changed");
    const artifactName = `arcad-view-${this.config.tag}`;
    const artifacts = await this.api.request("GET", `${this.base}/actions/artifacts?name=${artifactName}&per_page=100`);
    const artifact = artifacts.artifacts.filter(a => a.name === artifactName && !a.expired && a.workflow_run?.head_sha === this.config.commit).sort((a, b) => b.id - a.id)[0];
    if (artifact && Number.isSafeInteger(artifact.workflow_run.id)) return { mode: "artifact", releaseId: release?.id, resumeRunId: artifact.workflow_run.id };
    requireValue(!assets.length, "Partial draft needs its original matching Actions artifact; existing files were preserved");
    return { mode: "build", releaseId: release?.id };
  }
  async createDraft() {
    try {
      return this.validateRelease(await this.api.request("POST", `${this.base}/releases`, { json: { tag_name: this.config.tag, target_commitish: this.config.commit, name: `Arcad View ${this.config.tag}`, body: this.config.notes, draft: true, prerelease: false } }));
    } catch (error) {
      if (!(error instanceof HttpError) || ![0, 422, 429, 500, 502, 503, 504].includes(error.status)) throw error;
      for (let attempt = 0; attempt < 5; attempt++) { await this.wait(1000 * (attempt + 1)); const existing = await this.findRelease(); if (existing) return existing; }
      throw new Error("Could not reconcile draft creation; rerun safely rather than create another draft");
    }
  }
  async upload(release, file) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = (await this.assets(release.id)).find(a => a.name === file.name);
      if (existing) {
        if (existing.size === file.size && !existing.digest && attempt < 4) { await this.wait(1000 * (attempt + 1)); continue; }
        requireValue(this.matches(existing, file), `Existing asset differs: ${file.name}; preserved without overwrite`); return;
      }
      try {
        await this.api.request("POST", `https://uploads.github.com${this.base}/releases/${release.id}/assets?name=${encodeURIComponent(file.name)}`, { bytes: file.bytes });
        return;
      } catch (error) {
        if (!(error instanceof HttpError) || ![0, 422, 429, 500, 502, 503, 504].includes(error.status) || attempt === 4) throw error;
        await this.wait(1000 * (attempt + 1));
      }
    }
  }
  async publish(files, releaseId) {
    const descriptors = this.validateFiles(files);
    let release = releaseId ? this.validateRelease(await this.api.request("GET", `${this.base}/releases/${releaseId}`, { retry404: true })) : await this.findRelease();
    if (release && !release.draft) { await this.downloadVerified(release); this.log("Existing published release verified; no changes made."); return release; }
    if (!release) release = await this.createDraft();
    if (!release.draft) { await this.downloadVerified(release); return release; }
    for (const asset of await this.assets(release.id)) {
      const file = descriptors.get(asset.name);
      requireValue(asset.size === file.size && (!asset.digest || this.matches(asset, file)), `Existing asset differs: ${asset.name}; preserved without overwrite`);
    }
    // The creation response's numeric ID is authoritative, even if the draft
    // list or its temporary untagged URL has not become visible yet.
    for (const file of descriptors.values()) await this.upload(release, file);
    for (let attempt = 0; ; attempt++) {
      const assets = await this.assets(release.id);
      if (assets.length === descriptors.size && assets.every(a => this.matches(a, descriptors.get(a.name)))) break;
      requireValue(attempt < 5, "Uploaded asset digests did not become available; draft preserved"); await this.wait(1000 * (attempt + 1));
    }
    const latest = await this.api.request("GET", `${this.base}/releases/latest`, { allow404: true });
    const latestCode = latest?.assets?.map(a => /-([1-9][0-9]*)\.apk$/.exec(a.name)?.[1]).filter(Boolean).map(Number)[0] ?? 0;
    const makeLatest = this.config.code > latestCode;
    const published = this.validateRelease(await this.api.request("PATCH", `${this.base}/releases/${release.id}`, { json: { draft: false, make_latest: String(makeLatest) } }));
    requireValue(!published.draft, "Release is still a draft");
    const visible = this.validateRelease(await this.api.request("GET", `${this.base}/releases/tags/${this.config.tag}`, { retry404: true }));
    requireValue(visible.id === release.id && !visible.draft && visible.html_url === `https://github.com/${this.config.repository}/releases/tag/${this.config.tag}`, "Published release is not publicly visible");
    await this.downloadVerified(visible);
    if (makeLatest) {
      for (let attempt = 0; ; attempt++) { const current = await this.api.request("GET", `${this.base}/releases/latest`, { retry404: true }); if (current.id === release.id) break; requireValue(attempt < 5, "App update endpoint did not expose the new release"); await this.wait(1000 * (attempt + 1)); }
    }
    this.log(`Published and verified ${visible.html_url}`); return visible;
  }
}

async function main() {
  const [command, directory = "release-output"] = process.argv.slice(2);
  requireValue(["inspect", "publish"].includes(command), "Usage: node scripts/github-release.mjs inspect|publish [OUTPUT_DIR]");
  const pkg = JSON.parse(await readFile("package.json", "utf8")), metadata = JSON.parse(await readFile("release-config.json", "utf8"));
  const repository = `${metadata.owner}/${metadata.repository}`, tag = process.env.GITHUB_REF_NAME;
  requireValue(process.env.GITHUB_REPOSITORY === repository && process.env.GH_TOKEN, "Expected repository and GitHub Actions token");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  requireValue(execFileSync("git", ["rev-parse", `${tag}^{commit}`], { encoding: "utf8" }).trim() === commit, "Checkout does not match the release tag");
  const publisher = new ReleasePublisher(new GitHubApi(process.env.GH_TOKEN), { repository, tag, version: pkg.version, code: metadata.versionCode, commit, certificate: metadata.signingCertSha256, notes: await readFile("RELEASE_NOTES.md", "utf8") });
  await mkdir(directory, { recursive: true });
  if (command === "inspect") {
    const status = await publisher.inspect();
    if (status.files) for (const [name, bytes] of status.files) await writeFile(resolve(directory, name), bytes);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `mode=${status.mode}\nrelease_id=${status.releaseId ?? ""}\nresume_run_id=${status.resumeRunId ?? ""}\n`);
    console.log(`Release preflight: ${status.mode}${status.releaseId ? ` (ID ${status.releaseId})` : ""}`);
  } else {
    const names = await readdir(directory); requireValue(names.length === 4 && names.every(n => publisher.names.includes(n)), "Unexpected release output files");
    const files = new Map(await Promise.all(names.map(async n => [n, await readFile(resolve(directory, n))])));
    const release = await publisher.publish(files, process.env.ARCAD_RELEASE_ID ? Number(process.env.ARCAD_RELEASE_ID) : undefined);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `Published and verified: ${release.html_url}\n\n` + [...files].map(([name, bytes]) => `- ${name}: SHA-256 ${hash(bytes)}`).join("\n") + "\n");
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
