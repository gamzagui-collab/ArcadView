// Runs only in the private disposable conversion WebView, never the viewer.
(async () => {
  let worker;
  try {
    const input = await fetch('/input.dwg', { cache: 'no-store' }).then(response => {
      if (!response.ok) throw Error('Could not read staged DWG.');
      return response.arrayBuffer();
    });
    worker = new Worker(NativeConversion.workerUrl(), { type: 'module' });
    worker.onerror = event => NativeConversion.fail(JSON.stringify({ code: 'DWG_RUNTIME_MISSING', message: event.message }));
    worker.onmessage = event => {
      const value = event.data;
      if (value.status !== 'success') { NativeConversion.fail(JSON.stringify(value)); return; }
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
      } catch (error) { NativeConversion.fail(JSON.stringify({ code: 'DWG_EXPORT_FAILED', message: String(error) })); }
    };
    worker.postMessage({ id: 1, input, baseUrl: location.origin + '/' }, [input]);
  } catch (error) { NativeConversion.fail(JSON.stringify({ code: 'DWG_CONVERSION_FAILED', message: String(error) })); }
})();
