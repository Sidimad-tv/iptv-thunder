const USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250 Safari/533.3';

const TEXT_CONTENT_TYPES = ['application/json', 'text/', 'application/xml', 'text/xml'];

function isTextContentType(contentType) {
  if (!contentType) return true;
  const ct = contentType.toLowerCase();
  return TEXT_CONTENT_TYPES.some(t => ct.startsWith(t) || ct.includes(t));
}

export default async function handler(req, res) {
  const { url, _auth, _cookie, ...queryParams } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    if (Array.isArray(value)) {
      value.forEach(v => params.append(key, v));
    } else {
      params.set(key, value);
    }
  }

  const targetUrl = params.toString() ? url + '?' + params.toString() : url;

  const headers = {
    'User-Agent': USER_AGENT,
    'X-User-Agent': USER_AGENT,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
  };

  if (_auth) headers['Authorization'] = _auth;
  if (_cookie) headers['Cookie'] = _cookie;

  try {
    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers,
    });

    const contentType = response.headers.get('content-type') || '';

    // For binary content (streams, video), pipe through as-is
    if (!isTextContentType(contentType)) {
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.byteLength);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      return res.status(response.status).send(Buffer.from(buffer));
    }

    // For text content (API responses), try to parse as JSON
    const text = await response.text();

    let jsonData;
    let parseFailed = false;
    try {
      jsonData = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          jsonData = JSON.parse(jsonMatch[1]);
        } catch {
          parseFailed = true;
        }
      } else {
        parseFailed = true;
      }
    }

    if (!parseFailed && jsonData) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(response.status).json(jsonData);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status).send(text);
  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(502).json({ error: 'Proxy request failed', message: error.message });
  }
}
