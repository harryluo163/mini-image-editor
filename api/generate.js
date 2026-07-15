// Vercel Serverless Function: creates a ModelScope async image-generation
// task and returns its task_id. Actual result retrieval is driven by the
// browser polling api/task.js, so no single function invocation ever needs
// to stay alive past Vercel's 60s hard cap.
//
// Contract (POST /api/generate):
//   Request  JSON: { model: string, prompt: string, image?: string }
//     - `image` is an optional data URL / URL used for image-to-image /
//       edit models such as Qwen-Image-Edit; forwarded as `image_url`.
//   Response 200 : JSON { task_id: string }
//   Response 4xx/5xx: JSON { error: string }

// Keep in sync with AI_MODELS in src/app/models/ai-generation.model.ts.
const ALLOWED_MODELS = new Set([
  'Qwen/Qwen-Image-2512',
  'MusePublic/stable-diffusion-xl-base',
  'Qwen/Qwen-Image-Edit'
]);

const MODELSCOPE_BASE = 'https://api-inference.modelscope.cn/';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.MODELSCOPE_TOKEN;
  if (!token) {
    res.status(500).json({
      error: 'Server misconfigured: MODELSCOPE_TOKEN environment variable is not set.'
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

  const model = body.model;
  const prompt = body.prompt;
  const image = typeof body.image === 'string' && body.image.trim() ? body.image : null;

  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model)) {
    res.status(400).json({ error: 'Missing or non-whitelisted `model`.' });
    return;
  }
  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: '`prompt` is required.' });
    return;
  }

  try {
    const createBody = { model, prompt: prompt.trim() };
    if (image) {
      // ModelScope's async images/generations endpoint uses `image_url` for
      // edit-model source inputs; it accepts both HTTP URLs and data URIs.
      createBody.image_url = image;
    }

    const createResp = await fetch(`${MODELSCOPE_BASE}v1/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-ModelScope-Async-Mode': 'true'
      },
      body: JSON.stringify(createBody)
    });

    if (!createResp.ok) {
      const text = await createResp.text().catch(() => '');
      res.status(createResp.status).json({
        error: `ModelScope create-task failed (${createResp.status}): ${text.slice(0, 500) || createResp.statusText}`
      });
      return;
    }

    const data = await createResp.json().catch(() => ({}));
    const taskId = data.task_id;
    if (!taskId) {
      res.status(502).json({
        error: `ModelScope did not return a task_id. Payload: ${JSON.stringify(data).slice(0, 300)}`
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ task_id: taskId });
  } catch (err) {
    res.status(502).json({
      error: `Proxy failure: ${err && err.message ? err.message : 'unknown network error'}`
    });
  }
};
