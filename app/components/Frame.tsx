import { default as DOMPurify } from 'dompurify';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useEffect } from 'foxact/use-abortable-effect';
import { m } from '~/paraglide/messages';

const FRAME_SCRIPT = `function reportHeight() {
  var h = document.body ? document.body.scrollHeight : 0;
  if (h > 0) parent.postMessage({ __emailIframeHeight: true, height: h }, "*");
}
reportHeight();
window.addEventListener('load', reportHeight);
if (window.ResizeObserver) {
  new ResizeObserver(reportHeight).observe(document.body);
} else {
  setTimeout(reportHeight, 100);
  setTimeout(reportHeight, 500);
}`;

let frameScriptCsp: Promise<string> | undefined;

function getFrameScriptCsp(): Promise<string> {
  frameScriptCsp ??= crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(FRAME_SCRIPT))
    .then((buffer) => `sha256-${btoa(String.fromCharCode(...new Uint8Array(buffer)))}`);
  return frameScriptCsp;
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const REMOTE_URL_REGEX = /(?:src(?:set)?\s*=\s*["']|url\(\s*["']?)(https:\/\/[^"'\s)>]+)/gi;

function hasRemoteContent(body: string, origin: string): boolean {
  for (const match of body.matchAll(REMOTE_URL_REGEX)) {
    if (!match[1].startsWith(origin)) return true;
  }
  return false;
}

export default function Frame({ body }: { body: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(100);
  const [remoteAllowedFor, setRemoteAllowedFor] = useState<string | null>(null);
  const allowRemote = remoteAllowedFor === body;
  const remote = useMemo(
    () => typeof window !== 'undefined' && hasRemoteContent(body, window.location.origin),
    [body]
  );

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.source !== iframeRef.current?.contentWindow) return;
    if (
      event.data
      && typeof event.data === 'object'
      && event.data.__emailIframeHeight
      && typeof event.data.height === 'number'
      && event.data.height > 0
    ) {
      setHeight(event.data.height);
    }
  }, []);

  useEffect(
    (signal) => {
      window.addEventListener('message', handleMessage, { signal });
    },
    [handleMessage]
  );

  useEffect(
    (signal) => {
      const iframe = iframeRef.current;
      if (!iframe || !body) return;

      const cleanBody = DOMPurify.sanitize(body, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea'],
        FORCE_BODY: true
      });

      const origin = window.location.origin;
      const imgSrc = allowRemote
        ? `img-src data: cid: ${origin} https:;`
        : `img-src data: cid: ${origin};`;

      void getFrameScriptCsp().then((scriptCsp) => {
        if (signal.aborted || !iframeRef.current) return;
        iframeRef.current.srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; ${imgSrc} script-src '${scriptCsp}'; form-action 'none'; base-uri 'none';">
<style>
* { box-sizing: border-box; }
html {
  background: #ffffff;
  color-scheme: light;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #1a1a1a;
  background: #ffffff;
  padding: 0;
  margin: 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  overflow: hidden;
}
[style*="position: fixed"], [style*="position:fixed"], [style*="position: absolute"], [style*="position:absolute"] {
  position: relative !important;
}
a { color: #2563eb; }
img { max-width: 100%; height: auto; }
blockquote {
  border-left: 3px solid #d1d5db;
  padding-left: 1em;
  margin-left: 0;
  color: #6b7280;
}
pre {
  background: #f3f4f6;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
}
table { border-collapse: collapse; max-width: 100%; }
td, th { padding: 4px 8px; }
p { margin: 4px 0; }
h1, h2, h3 { margin: 8px 0 4px; }
ul, ol { padding-left: 20px; margin: 4px 0; }
</style>
</head>
<body>${cleanBody}<script>${FRAME_SCRIPT}</script></body>
</html>`;
      });
    },
    [body, allowRemote]
  );

  return (
    <div className="flex flex-col">
      {remote && !allowRemote && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <span>{m.frameRemoteContentBlocked()}</span>
          <button
            type="button"
            onClick={() => setRemoteAllowedFor(body)}
            className="shrink-0 font-medium text-foreground underline underline-offset-2 hover:text-primary"
          >
            {m.frameShowRemote()}
          </button>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="block w-full border-0"
        style={{ height: `${height}px` }}
        sandbox="allow-scripts allow-popups"
        title="Email content"
      />
    </div>
  );
}
