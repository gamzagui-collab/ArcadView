import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Only talks to an adb-forwarded loopback endpoint, never to a remote service.
const [portArg, directoryArg, secondsArg = '5'] = process.argv.slice(2);
const port = Number(portArg), seconds = Number(secondsArg);
if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isFinite(seconds) || seconds < 0 || seconds > 3600) {
  throw new Error('Usage: node scripts/android-webview-probe.mjs <forwarded-port> <output-directory> [seconds<=3600]');
}
const directory = resolve(directoryArg);
await mkdir(directory, { recursive: true });
const pages = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(10000) }).then(r => r.json());
const page = pages.find(p => p.type === 'page' && p.url === 'https://localhost/');
if (!page) throw new Error('izCAD bundled WebView was not found on the selected app socket.');
const socketUrl = new URL(page.webSocketDebuggerUrl);
if (!['127.0.0.1', 'localhost'].includes(socketUrl.hostname) || Number(socketUrl.port) !== port) throw new Error('Unexpected non-local debugging endpoint.');
const socket = new WebSocket(socketUrl);
const pending = new Map(), events = [];
let sequence = 0;
socket.addEventListener('message', e => {
  const message = JSON.parse(e.data);
  if (message.id) {
    const item = pending.get(message.id);
    if (item) { clearTimeout(item.timer); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); }
  } else events.push({ time: new Date().toISOString(), ...message });
});
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
try {
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  await send('Runtime.enable');
  await send('Log.enable');
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  const evaluation = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const canvas = document.querySelector('canvas');
    return { title: document.title, url: location.href, language: document.documentElement.lang,
      userAgent: navigator.userAgent, text: document.body.innerText.slice(0, 12000),
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      errorScreen: document.querySelector('.error-copy')?.textContent ?? null,
      viewerReady: !!document.querySelector('.viewer-toolbar'),
      wasm: typeof WebAssembly === 'object' };
  })()` });
  const errors = events.filter(e => e.method === 'Runtime.exceptionThrown' ||
    e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error' ||
    e.method === 'Log.entryAdded' && e.params.entry.level === 'error');
  const result = { connected: true, target: { id: page.id, title: page.title, url: page.url },
    observationSeconds: seconds, state: evaluation.result?.value, errors, eventCount: events.length };
  await writeFile(resolve(directory, 'webview-events.json'), JSON.stringify(events, null, 2));
  await writeFile(resolve(directory, 'webview.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  // Capturing a console error is evidence, not a failed debugger connection.
  // Keep errors in the report; fail the run if the app displays an error page.
  if (result.state?.errorScreen) process.exitCode = 1;
} finally { socket.close(); }
