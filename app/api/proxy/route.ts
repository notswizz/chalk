import { NextRequest, NextResponse } from 'next/server';

// Streaming embed/CDN domains rotate frequently — match by pattern.
// The .space TLD is used heavily by these CDNs with rotating subdomains.
const ALLOWED_HOST_PATTERNS = [
  /\.?aapmains\.net$/,
  /\.?scdnmain\.net$/,
  /\.space$/,         // covers kamfir8, wecanfix3, zenithstellar, heisdead3, etc.
  /\.?topembed\./,
  /\.?dlhd\./,
  /\.?embedme\./,
  /\.?sportsonline\./,
];

function isHostAllowed(hostname: string): boolean {
  return ALLOWED_HOST_PATTERNS.some((p) => p.test(hostname));
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('Missing url param', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  // Only proxy from known streaming hosts
  if (!isHostAllowed(parsed.hostname)) {
    return new NextResponse('Host not allowed', { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': req.headers.get('user-agent') || '',
        'Referer': 'https://gooz.aapmains.net/',
        'Origin': 'https://gooz.aapmains.net',
      },
    });

    if (!res.ok) {
      return new NextResponse('Upstream error', { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';

    // HLS playlist — rewrite segment/sub-playlist URLs to go through proxy
    if (contentType.includes('mpegurl') || url.includes('playlist') || url.endsWith('.m3u8')) {
      const body = await res.text();
      const rewritten = body
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('#') || trimmed === '') return line;
          // It's a URL line (segment or sub-playlist)
          const absolute = trimmed.startsWith('http')
            ? trimmed
            : new URL(trimmed, url).toString();
          return `/api/proxy?url=${encodeURIComponent(absolute)}`;
        })
        .join('\n');

      return new NextResponse(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // TS segments — stream binary data through.
    // Some CDNs disguise segments as .txt files, so also check URL patterns.
    const isSegment =
      contentType.includes('mp2t') ||
      contentType.includes('octet-stream') ||
      url.endsWith('.ts') ||
      /\/scripts\/.*\.txt$/.test(parsed.pathname) ||
      /p\d+_\d+\.txt$/.test(parsed.pathname);

    if (isSegment) {
      const body = await res.arrayBuffer();
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'video/mp2t',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // HTML (embed pages) — strip CSP
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new NextResponse('Proxy error', { status: 502 });
  }
}
