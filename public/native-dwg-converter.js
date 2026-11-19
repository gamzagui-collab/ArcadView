// Runs only in the private disposable conversion WebView, never the viewer.
(async () => {
  let worker;
  const fail = value => { worker?.terminate(); NativeConversion.fail(JSON.stringify(value)); };
  const code = error => /out of memory|cannot enlarge memory|allocat.*fail|invalid (array|typed array|string) length|oom/i.test(String(error)) ? "DWG_MEMORY_LIMIT" : "DWG_CONVERSION_FAILED";
  try {
    const input = await fetch('/input.dwg', { cache: 'no-store' }).then(response => {
      if (!response.ok) throw Error('Could not read staged DWG.');
      return response.arrayBuffer();
    });
    worker = new Worker(NativeConversion.workerUrl(), { type: 'module' });
    worker.onerror = event => fail({ code: code(event.message), message: event.message });
    worker.onmessage = event => {
      const value = event.data;
      if (value.status !== 'success') { fail(value); return; }
      try {
        const bytes = new Uint8Array(value.output);
        for (let offset = 0; offset < bytes.length; offset += 256 * 1024) {
          const chunk = bytes.subarray(offset, Math.min(offset + 256 * 1024, bytes.length));
          let text = '';
          for (let start = 0; start < chunk.length; start += 8192) text += String.fromCharCode(...chunk.subarray(start, start + 8192));
          NativeConversion.appendOutput(btoa(text));
        }
        worker.terminate();
        NativeConversion.complete(JSON.stringify(value.savedView));
      } catch (error) { fail({ code: code(error), message: String(error) }); }
    };
    worker.postMessage({ id: 1, input, baseUrl: location.origin + '/' }, [input]);
  } catch (error) { fail({ code: code(error), message: String(error) }); }
})();
