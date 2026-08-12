import { default as DOMPurify } from 'dompurify';
import { useRef, useState } from 'react';
import { useEffect } from 'foxact/use-abortable-effect';

interface EmailIframeProps {
  body: string,
  autoSize?: boolean
}

export default function EmailIframe({ body, autoSize }: EmailIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(autoSize ? 100 : 0);

  useEffect(
    (signal) => {
      const handleMessage = (event: MessageEvent) => {
        if (!autoSize) return;
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
      };
      window.addEventListener('message', handleMessage, { signal });
    },
    [autoSize]
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !body) return;

    const cleanBody = DOMPurify.sanitize(body, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style'],
      ADD_ATTR: ['target'],
      FORCE_BODY: true
    });

    const padding = autoSize ? '0' : '24px';

    const heightScript = autoSize
      ? `<script>
        function reportHeight() {
          var h = document.body.scrollHeight;
          if (h > 0) parent.postMessage({ __emailIframeHeight: true, height: h }, "*");
        }
        reportHeight();
        setTimeout(reportHeight, 50);
        setTimeout(reportHeight, 150);
        setTimeout(reportHeight, 400);
      </script>`
      : '';

    iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: cid: https:; script-src 'unsafe-inline';">
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
  padding: ${padding};
  margin: 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  ${autoSize ? 'overflow: hidden;' : ''}
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
<body>${cleanBody}${heightScript}</body>
</html>`;
  }, [body, autoSize]);

  return (
    <iframe
      ref={iframeRef}
      className="block w-full border-0"
      style={autoSize ? { height: `${height}px` } : { height: '100%' }}
      sandbox="allow-scripts allow-popups allow-top-navigation-by-user-activation"
      title="Email content"
    />
  );
}
