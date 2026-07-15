export const environment = {
  production: false,
  // All Hugging Face traffic goes through the same-origin `/api/generate`
  // serverless proxy defined in `mini-image-editor/api/generate.js`. This
  // sidesteps CORS on `api-inference.huggingface.co` and keeps the HF token
  // (HF_TOKEN env var) server-side only. Never put a real token in this file.
  apiProxyUrl: '/api/generate'
};
