# Creaition Mini Image Editor

An Angular 17 mini image editor that layers the **Creaition** design system on top of Toast UI Image Editor, plus a full AI-generation studio wired to Hugging Face Inference (Stable Diffusion XL, SD 1.5, and Qwen Image Edit — swappable at runtime).

> **Live demo:** _<add your Vercel/Netlify URL here after deployment>_

![screenshot placeholder — replace with real UI capture](./docs/screenshot-main.png)
![screenshot placeholder — AI generation panel with history](./docs/screenshot-ai.png)

## Features

### Part 1 — Design system integration

- **Creaition typography** using the Google Fonts **Recursive** variable font (loaded in `index.html`) aliased under the brand name `strokeWeight(var)`. `font-variation-settings` drives:
  - `wght` (design tokens 60 / 80 / 120 mapped to Recursive's 400 / 500 / 700)
  - `slnt` axis for the hover italic effect
- Monochromatic palette: `#efefee`, `#bebebe`, `#f0f0f0`, `#ffffff`, `#000000`
- 50 px pill buttons, 0 px inputs, 1 rem cards
- Hover animation transitions the `slnt` axis on the same element without changing the type family
- Custom overrides applied on top of Toast UI Image Editor's CSS
- Angular Material integrated for the error `MatSnackBar` toast, with theme overrides in `creaition-theme.scss`

### Part 2 — AI generation + state management

- **Multiple AI models** (dropdown-switchable at runtime):
  - Stable Diffusion XL (`stabilityai/stable-diffusion-xl-base-1.0`)
  - Stable Diffusion 1.5 (`stable-diffusion-v1-5/stable-diffusion-v1-5` — the original `runwayml/stable-diffusion-v1-5` repo was removed by its author)
  - Qwen Image Edit (`Qwen/Qwen-Image-Edit`)
- **Text-to-image**, **image-to-image** (uses the current canvas as source), and **image enhancement** (upscale/detail via prompt-biased img2img)
- **Batch generation** — up to 4 images per request, guidance scale varied per item for diverse results
- **Prompt suggestions** — category chips + debounced autocomplete against a curated library
- **RxJS state management** via `BehaviorSubject`; derived observables for `generationState$`, `progress$`, `error$`, `selectedModel$`, `batchProgress$`
- **History + favourites** with capped, quota-safe `localStorage` persistence (drops half the history on `QuotaExceededError` and retries)
- **User preferences** (model, size, steps, guidance, batch, img2img toggle, negative prompt) persisted separately from history so a reload keeps your sliders
- **Retry-on-error**: the error banner and the `AiStateService.retryLast()` API replay the exact last request
- **Exponential-backoff retries** on HTTP 429 (rate limit) and 503 (cold start): 1 s → 2 s → 4 s, implemented with the modern RxJS `retry({ delay })` operator
- Loading UX: progress bar (aggregated across batches), skeleton preview tiles, per-item batch counter, and a `MatSnackBar` toast on error

### Responsive design

Mobile-first with the design-system breakpoints:

| Token | Width | Behaviour |
|---|---|---|
| `sm` | ≤ 640 px | Action buttons stack, header condensed, image grid → 2 cols |
| `md` | ≤ 768 px | Toolbar collapses behind menu toggle, right sidebar becomes a drawer, properties panel becomes a **full-screen modal below the header** driven by `[isMobileVisible]` |
| `lg` | ≤ 1024 px | Tool button labels collapse into icons |
| `xl` | ≤ 1280 px | Sidebar widths shrink incrementally |

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Angular 17 (standalone components) |
| Image editor | Toast UI Image Editor 3.15 via CDN |
| Variable font | Google Fonts Recursive (via CDN, aliased in SCSS) |
| Styling | SCSS + CSS custom properties |
| UI kit | Angular Material 17 (MatSnackBar) |
| State | RxJS `BehaviorSubject` |
| HTTP | `provideHttpClient()` + typed services |
| AI backend | Hugging Face Inference API, called via a same-origin `/api/generate` Vercel Serverless proxy (Bearer auth stays on the server) |

## Project layout

```
src/
├── app/
│   ├── components/
│   │   ├── image-editor/          # TUI Image Editor wrapper (public API only)
│   │   ├── toolbar/               # Tool + action buttons, Creaition-styled
│   │   ├── properties-panel/      # Draw / filter / crop / rotate / text / shape
│   │   └── ai-generation-panel/   # Prompt, model select, img2img, batch, history
│   ├── services/
│   │   ├── ai-image.service.ts       # Talks to /api/generate (no client-side token)
│   │   ├── ai-state.service.ts       # RxJS store + generation workflows
│   │   ├── ai-preferences.service.ts # localStorage-backed user settings
│   │   └── prompt-suggestion.service.ts
│   ├── models/
│   │   └── ai-generation.model.ts    # ModelConfig, AI_MODELS, state shapes
│   ├── app.component.*               # Layout + inter-component orchestration
│   └── app.config.ts
├── environments/                     # apiProxyUrl only — token lives on the server
├── styles/
│   └── creaition-theme.scss          # Tokens, buttons, inputs, cards, breakpoints
├── index.html                        # CDN loads (TUI, Recursive font)
└── styles.scss                       # Global reset + TUI overrides
api/
└── generate.js                       # Vercel Serverless proxy → Hugging Face
```

## Setup

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install & run

```bash
git clone <repository-url>
cd mini-image-editor
npm install
npm start        # ng serve on http://localhost:4200
```

### API configuration

The browser never talks to Hugging Face directly — it POSTs to the same-origin
`/api/generate` Vercel Serverless Function (`api/generate.js`), which attaches
the HF Bearer token server-side. This fixes CORS on `api-inference.huggingface.co`
**and** keeps your token out of the client bundle.

1. Grab a token from <https://huggingface.co/settings/tokens>.
2. Expose it to the server:
   - **Vercel:** Project → Settings → Environment Variables → add `HF_TOKEN`.
   - **Local dev with `vercel dev`:** create `.env.local` (git-ignored) with
     `HF_TOKEN=hf_xxx`. `vercel dev` will hand it to the function.
   - **Local dev with `ng serve` only:** the `/api/generate` route won't exist —
     run `vercel dev` in a second terminal, or use `vercel dev` instead of
     `ng serve` so both the SPA and the proxy are served from the same origin.
3. **Never put a token in `src/environments/*.ts`.** Those files are compiled
   into the client bundle and shipped to every visitor.

If you need to add or swap a model, update **both**:
- `AI_MODELS` in `src/app/models/ai-generation.model.ts` (used by the UI), and
- `ALLOWED_ENDPOINTS` in `api/generate.js` (whitelist that prevents the proxy
  from being used as an open relay).

### Testing

```bash
npm test                        # Karma + Jasmine, watch mode
npm test -- --code-coverage     # HTML coverage in coverage/
```

The test suite covers `AiImageService`, `AiStateService`, `AiPreferencesService`, `PromptSuggestionService`, plus component behaviour tests for all four components.

## Deployment (Vercel)

The repo ships with a `vercel.json` that:

- runs `npm run build -- --configuration=production`
- serves `dist/mini-image-editor/browser`
- rewrites all routes to `index.html` (SPA)
- sends long-lived cache headers for hashed static assets
- auto-picks up `api/generate.js` as a Node Serverless Function

```bash
npm i -g vercel
vercel deploy       # follow the prompts once; subsequent deploys are one command
# or
vercel --prod
```

Before the first deploy, set `HF_TOKEN` in the Vercel dashboard
(Settings → Environment Variables). The client bundle contains **no** token —
it only knows about `/api/generate`.

## Design decisions

1. **CDN for TUI Image Editor.** The npm package ships CommonJS and doesn't play nicely with Angular 17's ESM-first build pipeline. Loading from the CDN keeps the bundle lean and avoids Babel gymnastics; the trade-off is a runtime network dependency, which is acceptable for a demo. The npm package was removed from `package.json` to eliminate the duplicate load.
2. **Recursive → strokeWeight(var).** The brand font in the design spec ("strokeWeight(var)") is proprietary. Google Fonts' Recursive is a public variable font with the same axes (`wght`, `slnt`) and is aliased at the top of every font-family fallback chain so the design intent is preserved with a real, freely available substitute.
3. **RxJS over NgRx.** A single-page app with three domain concerns (state, preferences, transport) doesn't need the ceremony of actions/reducers/effects. `BehaviorSubject` + selector-style `map` observables gives us the same reactive story with a fraction of the code.
4. **Preferences separate from history.** History is large (base64 images) and short-lived; preferences are tiny (<1 KB) and long-lived. Keeping them in separate `localStorage` keys means one service failing gracefully (quota exceeded on history) never nukes the user's sliders.
5. **Standalone components everywhere.** Better tree-shaking, no `NgModule` boilerplate, easier lazy-loading if we grow.
6. **Retry via RxJS 7 `retry({ delay })`.** Replaces the deprecated `retryWhen`, keeps the exponential-backoff logic declarative, and short-circuits on non-recoverable errors (anything other than 429/503).
7. **Angular Material — surgical use.** Instead of adopting the whole Material design language, we use only what solves a real problem (`MatSnackBar` for error toasts) and let Creaition tokens override its appearance in `creaition-theme.scss`.
8. **Enhance via biased img2img** rather than a dedicated upscaler model, which keeps us on a single HF endpoint per request and inside the free-tier quota.

## Challenges & solutions

| Challenge | Solution |
|---|---|
| Angular 17 + Toast UI Image Editor (CJS) incompatibility | Load the library from a CDN; declare `tui` as `any` in the wrapper component |
| `font-variation-settings` axis clashes with Angular Material's defaults | Explicit `!important` overrides on `.mat-mdc-*` selectors in `creaition-theme.scss` |
| HF free-tier cold starts (~20 s on 503) | Exponential-backoff retries (1 s → 2 s → 4 s) + a simulated progress bar that ramps to 90 % during the wait, then snaps to 100 % on success |
| Base64 history filling `localStorage` (~5 MB cap) | `MAX_HISTORY = 30` + `QuotaExceededError` handler that drops the oldest half and retries once |
| Mobile properties panel silently invisible (previous bug) | Proper `[isMobileVisible]` binding from `AppComponent`, and full-screen modal styling below the `md` breakpoint |
| Model-specific parameter differences (e.g. Qwen ignores `negative_prompt`) | `ModelConfig.supportsNegativePrompt` flag; UI hides the field and the service omits it from the payload |

## Screenshots

Add real captures to `docs/`:

- `docs/screenshot-main.png` — full editor with canvas, toolbar and AI panel
- `docs/screenshot-ai.png` — AI generation panel with history/favourites
- `docs/screenshot-mobile.png` — mobile layout with the properties modal open

## License

MIT
