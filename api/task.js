// Vercel Serverless Function: checks a ModelScope image-generation task's
// status. Split out from api/generate.js so the browser can drive its own
// polling loop, side-stepping Vercel's 60s function-duration ceiling for
// long edit-model generations. Each invocation of this endpoint is cheap
// (~1 upstream GET + at most 1 image download).
//
// Contract (GET /api/task?id=<task_id>):
//   Response 200 (still running): JSON { status: string }  -- lowercased
//   Response 200 (done)         : image bytes (Content-Type from upstream)
//   Response 4xx/5xx            : JSON { error: string }

const MODELSCOPE_BASE = 'https://api-inference.modelscope.cn/';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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

  const rawId = req.query && typeof req.query.id === 'string' ? req.query.id : '';
  const taskId = rawId.trim();
  if (!taskId) {
    res.status(400).json({ error: '`id` query parameter is required.' });
    return;
  }

  try {
    const pollResp = await fetch(`${MODELSCOPE_BASE}v1/tasks/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-ModelScope-Task-Type': 'image_generation'
      }
    });

    if (!pollResp.ok) {
      const text = await pollResp.text().catch(() => '');
      res.status(pollResp.status).json({
        error: `ModelScope poll failed (${pollResp.status}): ${text.slice(0, 500) || pollResp.statusText}`
      });
      return;
    }

    const data = await pollResp.json().catch(() => ({}));
    const status = data.task_status;

    if (status === 'SUCCEED') {
      const imageUrl = data.output_images && data.output_images[0];
      if (!imageUrl) {
        res.status(502).json({ error: 'Task succeeded but no output image URL was returned.' });
        return;
      }
      // Fetch the actual bytes so the browser receives a same-origin
      // response (ModelScope's asset URLs may not be CORS-friendly).
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) {
        res.status(502).json({ error: `Failed to download generated image: ${imgResp.status}` });
        return;
      }
      const contentType = imgResp.headers.get('content-type') || 'image/png';
      const buffer = Buffer.from(await imgResp.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(buffer);
      return;
    }

    if (status === 'FAILED') {
      res.status(500).json({
        error: `ModelScope task failed: ${data.error_message || data.message || 'unknown reason'}`
      });
      return;
    }

    // Still queued or running. Return the lowercased status so the client
    // can display "pending" / "running" if it wants to.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: typeof status === 'string' ? status.toLowerCase() : 'pending'
    });
  } catch (err) {
    res.status(502).json({
      error: `Proxy failure: ${err && err.message ? err.message : 'unknown network error'}`
    });
  }
};
