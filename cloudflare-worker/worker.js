// Deploy at proxy.chalkstreams.live via Cloudflare Workers
// Free tier: 100k requests/day, no bandwidth cap

const ALLOWED_HOST_PATTERNS = [
  /\.?aapmains\.net$/,
  /\.?scdnmain\.net$/,
  /\.space$/,
  /\.shop$/,
  /\.?topembed\./,
  /\.?dlhd\./,
  /\.?embedme\./,
  /\.?sportsonline\./,
];

function isHostAllowed(hostname) {
  return ALLOWED_HOST_PATTERNS.some((p) => p.test(hostname));
}

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing url param', { status: 400 });

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response('Invalid url', { status: 400 });
    }

    if (!isHostAllowed(parsed.hostname)) {
      return new Response('Host not allowed', { status: 403 });
    }

    try {
      const response = await fetch(target, {
        headers: {
          'User-Agent': request.headers.get('user-agent') || '',
          'Referer': 'https://gooz.aapmains.net/',
          'Origin': 'https://gooz.aapmains.net',
        },
      });

      if (!response.ok) {
        return new Response('Upstream error', { status: response.status });
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      // HLS playlist — rewrite segment URLs to go through this worker
      if (contentType.includes('mpegurl') || target.includes('playlist') || target.endsWith('.m3u8')) {
        const body = await response.text();
        const workerOrigin = url.origin;
        const rewritten = body
          .split('\n')
          .map((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || trimmed === '') return line;
            const absolute = trimmed.startsWith('http')
              ? trimmed
              : new URL(trimmed, target).toString();
            return `${workerOrigin}/?url=${encodeURIComponent(absolute)}`;
          })
          .join('\n');

        return new Response(rewritten, {
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Cache-Control': 'no-cache',
          },
        });
      }

      // Binary segments (TS, etc.)
      const isSegment =
        contentType.includes('mp2t') ||
        contentType.includes('octet-stream') ||
        target.endsWith('.ts') ||
        /\/scripts\/.*\.txt$/.test(parsed.pathname) ||
        /p\d+_\d+\.txt$/.test(parsed.pathname);

      if (isSegment) {
        const body = await response.arrayBuffer();
        return new Response(body, {
          headers: {
            'Content-Type': 'video/mp2t',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
          },
        });
      }

      // Everything else
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      return new Response('Proxy error', { status: 502 });
    }
  },
};
