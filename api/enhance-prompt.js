// Vercel Serverless Function: rewrites a user's short idea into a richer
// text-to-image prompt via SenseNova's OpenAI-compatible chat completion
// endpoint.
//
// Why this exists:
//   1. Browser -> SenseNova direct calls would leak the SENSENOVA_TOKEN in
//      the SPA bundle and hit CORS from token.sensenova.cn.
//   2. Wrapping it here keeps the token server-side (SENSENOVA_TOKEN env
//      var) and gives the client a stable same-origin endpoint.
//
// Contract (POST /api/enhance-prompt):
//   Request  JSON: { prompt: string }
//   Response 200 : JSON { prompt: string }  -- rewritten prompt
//   Response 4xx/5xx: JSON { error: string }

const SENSENOVA_URL = 'https://token.sensenova.cn/v1/chat/completions';
const SENSENOVA_MODEL = 'sensenova-6.7-flash-lite';

const SYSTEM_PROMPT = [
  'You are a creative assistant that rewrites short user ideas into vivid',
  'English prompts for text-to-image models. Preserve the subject and',
  'intent, but add lighting, style, composition, and rendering details.',
  'Output ONLY the improved prompt as a single line, no quotes, no',
  'explanation, no leading label.'
].join(' ');

// Cap input length so a runaway paste cannot burn tokens.
const MAX_PROMPT_CHARS = 800;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.SENSENOVA_TOKEN;
  if (!token) {
    res.status(500).json({
      error: 'Server misconfigured: SENSENOVA_TOKEN environment variable is not set.'
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'Body is not valid JSON.' });
      return;
    }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Body must be a JSON object.' });
    return;
  }

  const userPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!userPrompt) {
    res.status(400).json({ error: '`prompt` is required.' });
    return;
  }
  if (userPrompt.length > MAX_PROMPT_CHARS) {
    res.status(400).json({ error: `Prompt too long (max ${MAX_PROMPT_CHARS} chars).` });
    return;
  }

  try {
    const upstream = await fetch(SENSENOVA_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: SENSENOVA_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        enable_thinking: false
      })
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      res.status(upstream.status).json({
        error: `SenseNova error (${upstream.status}): ${text.slice(0, 500) || upstream.statusText}`
      });
      return;
    }

    const data = await upstream.json().catch(() => ({}));
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';
    if (typeof content !== 'string' || !content.trim()) {
      res.status(502).json({
        error: `SenseNova returned no content. Payload: ${JSON.stringify(data).slice(0, 300)}`
      });
      return;
    }

    // Strip stray surrounding quotes the model sometimes adds.
    const cleaned = content.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
    res.status(200).json({ prompt: cleaned });
  } catch (err) {
    res.status(502).json({
      error: `Proxy failure: ${err && err.message ? err.message : 'unknown network error'}`
    });
  }
};
