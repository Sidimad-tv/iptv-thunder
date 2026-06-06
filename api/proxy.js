const USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250 Safari/533.3';

export default async function handler(req, res) {
  const { url, _auth, ...queryParams } = req.query;

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
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
  };

  if (_auth) {
    headers['Authorization'] = _auth;
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    const text = await response.text();
    return res.status(response.status).setHeader('content-type', contentType).send(text);
  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(502).json({ error: 'Proxy request failed', message: error.message });
  }
}
