import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { GitHubApi, HttpError, ReleasePublisher } from "../github-release.mjs";

const config = { repository: "owner/ArcadView", tag: "v2.1.6", version: "2.1.6", code: 33, commit: "a".repeat(40), certificate: "c".repeat(64), notes: "Release notes" };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const wait = async () => {};
function files(apk = "signed APK") {
  const apkName = "Arcad-View-v2.1.6-33.apk", sourceName = "Arcad-View-v2.1.6-source.zip";
  const files = new Map([[apkName, Buffer.from(apk)], [sourceName, Buffer.from("full source")]]);
  const sums = [...files].map(([n, b]) => `${sha(b)}  ${n}`);
  files.set("SHA256SUMS.txt", Buffer.from(sums.join("\n") + "\n"));
  files.set("release-info.json", Buffer.from(JSON.stringify({ tag: config.tag, versionName: config.version, versionCode: config.code, packageId: "com.izcad.viewer", commit: config.commit, signingCertSha256: config.certificate, assets: sums })));
  return files;
}
class Server {
  constructor() { this.calls = []; this.release = null; this.saved = new Map(); this.artifacts = []; this.latest = { id: 1, assets: [{ name: "Arcad-View-v2.1.5-32.apk" }] }; this.nextAsset = 100; }
  draft() { this.release = { id: 42, tag_name: config.tag, draft: true, prerelease: false, html_url: "https://github.com/owner/ArcadView/releases/tag/untagged-temporary" }; return this; }
  seed(data = files(), names = [...data.keys()]) { for (const name of names) this.add(name, data.get(name)); return this; }
  add(name, bytes) { const asset = { id: this.nextAsset++, name, size: bytes.length, digest: `sha256:${sha(bytes)}`, state: "uploaded" }; this.saved.set(asset.id, { asset, bytes }); return asset; }
  assets() { return [...this.saved.values()].map(v => ({ ...v.asset })); }
  view() { return { ...this.release, assets: this.assets() }; }
  writes() { return this.calls.filter(c => c.method !== "GET"); }
  async request(method, address, options = {}) {
    const path = address.startsWith("https:") ? new URL(address).pathname + new URL(address).search : address;
    this.calls.push({ method, path, options }); const base = "/repos/owner/ArcadView";
    if (method === "GET" && path === `${base}/releases/tags/v2.1.6`) { if (this.release && !this.release.draft) return this.view(); if (options.allow404) return null; throw new HttpError(404, path); }
    if (method === "GET" && path.startsWith(`${base}/releases?`)) {
      if (this.forbidListAfterCreate && this.created) throw new Error("New draft list is still invisible");
      if (this.hiddenLists > 0) { this.hiddenLists--; return []; }
      return this.release ? [this.view()] : [];
    }
    if (method === "GET" && path.startsWith(`${base}/actions/artifacts?`)) return { artifacts: this.artifacts };
    if (method === "GET" && path === `${base}/releases/latest`) return this.latest;
    if (method === "GET" && path === `${base}/releases/42`) return this.view();
    if (method === "GET" && path === `${base}/releases/42/assets?per_page=100`) return this.assets();
    if (method === "GET" && path.startsWith(`${base}/releases/assets/`)) {
      const saved = this.saved.get(Number(path.split("/").at(-1))); return this.corruptDownload ? Buffer.from("corrupt") : saved.bytes;
    }
    if (method === "POST" && path === `${base}/releases`) {
      this.draft(); this.created = true;
      assert.equal(options.json.target_commitish, config.commit); assert.equal(options.json.draft, true);
      if (this.loseCreationReply) { this.hiddenLists = 2; throw new HttpError(0, path); }
      return this.view();
    }
    if (method === "POST" && path.startsWith(`${base}/releases/42/assets?name=`)) {
      const name = new URL("https://uploads.github.com" + path).searchParams.get("name");
      assert.ok(!this.assets().some(a => a.name === name), "must not replace an existing asset");
      const asset = this.add(name, options.bytes);
      if (this.loseAssetReply) { this.loseAssetReply = false; throw new HttpError(0, path); }
      return asset;
    }
    if (method === "PATCH" && path === `${base}/releases/42`) {
      assert.equal(options.json.draft, false); this.release.draft = false;
      this.release.html_url = `https://github.com/${config.repository}/releases/tag/${config.tag}`;
      if (options.json.make_latest === "true") this.latest = this.view(); return this.view();
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  }
}
const publisher = server => new ReleasePublisher(server, config, { wait, log() {} });

test("creation response ID completes upload and publication while the new draft list stays invisible", async () => {
  const s = new Server(); s.forbidListAfterCreate = true;
  const result = await publisher(s).publish(files());
  assert.equal(result.draft, false); assert.equal(s.saved.size, 4);
  assert.equal(s.calls.filter(c => c.method === "POST" && c.path.endsWith("/releases")).length, 1);
  assert.equal(s.latest.id, 42);
});
test("a complete existing draft resumes with no recreation or uploads", async () => {
  const s = new Server().draft().seed(); const p = publisher(s), inspected = await p.inspect();
  assert.equal(inspected.mode, "draft"); await p.publish(inspected.files, inspected.releaseId);
  assert.deepEqual(s.writes().map(c => c.method), ["PATCH"]);
});
test("a partial draft restores its original artifact and uploads only missing assets", async () => {
  const s = new Server().draft().seed(files(), ["Arcad-View-v2.1.6-33.apk"]), original = s.assets()[0];
  s.artifacts = [{ id: 9, name: "arcad-view-v2.1.6", expired: false, workflow_run: { id: 91, head_sha: config.commit } }];
  const p = publisher(s), state = await p.inspect(); assert.equal(state.mode, "artifact"); assert.equal(state.resumeRunId, 91);
  await p.publish(files(), state.releaseId); assert.deepEqual(s.assets().find(a => a.id === original.id), original);
  assert.equal(s.writes().filter(c => c.method === "POST").length, 3);
});
test("an interrupted run before draft creation also reuses its saved artifact", async () => {
  const s = new Server(); s.artifacts = [{ id: 9, name: "arcad-view-v2.1.6", expired: false, workflow_run: { id: 91, head_sha: config.commit } }];
  const state = await publisher(s).inspect(); assert.equal(state.mode, "artifact"); assert.equal(state.releaseId, undefined);
});
test("a published release rerun verifies original bytes and never rebuilds or mutates it", async () => {
  const s = new Server().draft().seed(); s.release.draft = false; const original = s.assets();
  const p = publisher(s), state = await p.inspect(); assert.equal(state.mode, "published");
  await p.publish(files("nondeterministic rebuilt APK"), 42);
  assert.deepEqual(s.writes(), []); assert.deepEqual(s.assets(), original);
});
test("asset collisions fail before any upload or publication and preserve the existing asset", async () => {
  const s = new Server().draft().seed(files("different APK"), ["Arcad-View-v2.1.6-33.apk"]), original = s.assets();
  await assert.rejects(publisher(s).publish(files(), 42), /Existing asset differs/);
  assert.deepEqual(s.writes(), []); assert.deepEqual(s.assets(), original); assert.equal(s.release.draft, true);
});
test("a partial draft without a matching original artifact fails without changing files", async () => {
  const s = new Server().draft().seed(files(), ["release-info.json"]);
  s.artifacts = [{ id: 9, name: "arcad-view-v2.1.6", expired: false, workflow_run: { id: 91, head_sha: "b".repeat(40) } }];
  await assert.rejects(publisher(s).inspect(), /original matching Actions artifact/); assert.deepEqual(s.writes(), []);
});
test("wrong source commit or signer metadata cannot reach the release API", async () => {
  for (const field of ["commit", "signingCertSha256"]) {
    const s = new Server(), data = files(), metadata = JSON.parse(data.get("release-info.json")); metadata[field] = "wrong";
    data.set("release-info.json", Buffer.from(JSON.stringify(metadata))); await assert.rejects(publisher(s).publish(data), /metadata mismatch/); assert.equal(s.calls.length, 0);
  }
});
test("a lost creation reply recovers the created ID without making another draft", async () => {
  const s = new Server(); s.loseCreationReply = true; await publisher(s).publish(files());
  assert.equal(s.calls.filter(c => c.method === "POST" && c.path.endsWith("/releases")).length, 1); assert.equal(s.release.draft, false);
});
test("a lost upload reply reuses the matching uploaded file", async () => {
  const s = new Server(); s.loseAssetReply = true; await publisher(s).publish(files());
  assert.equal(s.saved.size, 4); assert.equal(s.writes().filter(c => c.path.includes("/assets?")).length, 4);
});
test("publishing an older draft does not demote a newer app-update release", async () => {
  const s = new Server(); s.latest = { id: 99, assets: [{ name: "Arcad-View-v2.1.7-34.apk" }] };
  await publisher(s).publish(files()); assert.equal(s.latest.id, 99); assert.equal(s.writes().find(c => c.method === "PATCH").options.json.make_latest, "false");
});
test("download corruption is detected when verifying an existing published release", async () => {
  const s = new Server().draft().seed(); s.release.draft = false; s.corruptDownload = true;
  await assert.rejects(publisher(s).inspect(), /checksum mismatch/); assert.deepEqual(s.writes(), []);
});
test("GitHub reads retry a newly created ID's temporary 404 and transient HTTP errors", async () => {
  const statuses = [404, 503, 200], waits = [];
  const api = new GitHubApi("secret", { wait: async n => waits.push(n), fetchImpl: async () => new Response("{}", { status: statuses.shift() }) });
  assert.deepEqual(await api.request("GET", "/repos/owner/ArcadView/releases/42", { retry404: true }), {}); assert.equal(waits.length, 2);
});
test("permission failures are not hidden by retries", async () => {
  let calls = 0; const api = new GitHubApi("secret", { wait, fetchImpl: async () => { calls++; return new Response("{}", { status: 403 }); } });
  await assert.rejects(api.request("GET", "/repos/owner/ArcadView/releases"), /HTTP 403/); assert.equal(calls, 1);
});
test("an unreadable successful POST reply is reconciled as an unknown outcome", async () => {
  const api = new GitHubApi("secret", { wait, fetchImpl: async () => new Response("incomplete reply", { status: 201 }) });
  await assert.rejects(api.request("POST", "/repos/owner/ArcadView/releases", { json: {} }), e => e instanceof HttpError && e.status === 0);
});
test("an interrupted binary response is retried without accepting partial bytes", async () => {
  let calls = 0; const api = new GitHubApi("secret", { wait, fetchImpl: async () => {
    if (++calls === 1) return new Response(new ReadableStream({ start(c) { c.error(new Error("connection lost")); } }));
    return new Response("complete APK");
  } });
  assert.equal((await api.request("GET", "/repos/owner/ArcadView/releases/assets/100", { binary: true })).toString(), "complete APK"); assert.equal(calls, 2);
});
test("draft asset redirects never forward credentials to the CDN", async () => {
  const calls = [], api = new GitHubApi("secret", { wait, fetchImpl: async (url, options) => {
    calls.push({ url, options }); return calls.length === 1 ? new Response(null, { status: 302, headers: { location: "https://release-assets.githubusercontent.com/file" } }) : new Response("APK");
  } });
  assert.equal((await api.request("GET", "/repos/owner/ArcadView/releases/assets/100", { binary: true })).toString(), "APK");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret"); assert.equal(calls[1].options.headers, undefined);
});
test("foreign redirects cannot receive release credentials or bytes", async () => {
  const api = new GitHubApi("secret", { wait, fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://example.com/file" } }) });
  await assert.rejects(api.request("GET", "/repos/owner/ArcadView/releases/assets/100", { binary: true }), /Unexpected release download redirect/);
});
