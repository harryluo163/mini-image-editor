export interface AiGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  sourceImage?: string; // Base64 encoded for image-to-image
  styleId?: string; // Selected image style preset id
}

export interface AiGeneratedImage {
  id: string;
  prompt: string;
  imageData: string; // Base64 encoded
  timestamp: number;
  isFavorite: boolean;
  modelId: string;
  parameters: AiGenerationRequest;
  tags?: string[];
}

export type GenerationState = 'idle' | 'loading' | 'success' | 'error';

export interface AiState {
  generationState: GenerationState;
  currentPrompt: string;
  generatedImages: AiGeneratedImage[];
  favorites: AiGeneratedImage[];
  error: string | null;
  progress: number;
  lastRequest: AiGenerationRequest | null;
  lastModelId: string | null;
}

export interface ModelConfig {
  id: string;
  name: string;
  endpoint: string;
  description: string;
  supportsImg2Img: boolean;
  supportsNegativePrompt: boolean;
  defaultSteps: number;
  defaultGuidance: number;
  maxWidth: number;
  maxHeight: number;
}

// Keep this list in sync with the ALLOWED_MODELS whitelist in
// mini-image-editor/api/generate.js. The `endpoint` field carries the
// ModelScope model id (not a URL) — the serverless proxy forwards it to
// api-inference.modelscope.cn's async images/generations endpoint.
export const AI_MODELS: ModelConfig[] = [
  {
    id: 'qwen-image',
    name: 'Qwen Image 2512',
    endpoint: 'Qwen/Qwen-Image-2512',
    description: 'ModelScope Qwen text-to-image, high-quality prompt adherence',
    supportsImg2Img: false,
    supportsNegativePrompt: false,
    defaultSteps: 30,
    defaultGuidance: 7.5,
    maxWidth: 1024,
    maxHeight: 1024
  },
  {
    id: 'sdxl',
    name: 'Stable Diffusion XL',
    endpoint: 'MusePublic/stable-diffusion-xl-base',
    description: 'ModelScope SDXL, 1024px, strong prompt adherence',
    supportsImg2Img: false,
    supportsNegativePrompt: false,
    defaultSteps: 30,
    defaultGuidance: 7.5,
    maxWidth: 1024,
    maxHeight: 1024
  },
  {
    id: 'qwen-edit',
    name: 'Qwen Image Edit',
    // Edit model — ModelScope rejects requests without a source image with
    // `Qwen Image Edit requires image upload`. The AI panel now attaches
    // the current canvas as `image` and api/generate.js forwards it as
    // `image_url` to the async images/generations endpoint.
    endpoint: 'Qwen/Qwen-Image-Edit',
    description: 'Edits an existing image — load/generate one first, then describe the change',
    supportsImg2Img: true,
    supportsNegativePrompt: false,
    defaultSteps: 20,
    defaultGuidance: 7,
    maxWidth: 1024,
    maxHeight: 1024
  }
];

// ─── Image Style System ───────────────────────────────────────────────────────

export interface ImageStylePreset {
  id: string;
  name: string;
  nameZh: string;
  /** Prompt modifier appended when this style is active */
  promptSuffix: string;
  /** CSS gradient used as thumbnail placeholder */
  thumbnail: string;
  isPro: boolean;
}

export interface StyleCategory {
  id: string;
  name: string;
  nameZh: string;
  presets: ImageStylePreset[];
}

export const IMAGE_STYLE_CATEGORIES: StyleCategory[] = [
  {
    id: 'default',
    name: 'Default',
    nameZh: '默认风格',
    presets: [
      {
        id: 'default-tone',
        name: 'Default Tone',
        nameZh: '默认色调',
        promptSuffix: '',
        thumbnail: 'linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%)',
        isPro: false
      },
      {
        id: 'warm-tone',
        name: 'Warm Tone',
        nameZh: '暖色调',
        promptSuffix: ', warm color palette, golden hour lighting, cozy atmosphere',
        thumbnail: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
        isPro: false
      },
      {
        id: 'cool-tone',
        name: 'Cool Tone',
        nameZh: '冷色调',
        promptSuffix: ', cool blue tones, moonlight ambiance, serene mood',
        thumbnail: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        isPro: false
      },
      {
        id: 'bw-filter',
        name: 'Black & White',
        nameZh: '黑白滤镜',
        promptSuffix: ', black and white photography, high contrast, monochrome',
        thumbnail: 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)',
        isPro: true
      },
      {
        id: 'candy-tone',
        name: 'Candy Tone',
        nameZh: '糖果色调',
        promptSuffix: ', pastel candy colors, sweet dreamy palette, soft pink and mint',
        thumbnail: 'linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%)',
        isPro: true
      },
      {
        id: 'sepia-tone',
        name: 'Sepia Tone',
        nameZh: '棕褐色调',
        promptSuffix: ', sepia toned, vintage brown hues, aged film look',
        thumbnail: 'linear-gradient(135deg, #a0522d 0%, #d2691e 100%)',
        isPro: true
      },
      {
        id: 'soft-light',
        name: 'Soft Light',
        nameZh: '柔光效果',
        promptSuffix: ', soft diffused lighting, gentle glow, ethereal atmosphere',
        thumbnail: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        isPro: true
      },
      {
        id: 'vintage',
        name: 'Vintage',
        nameZh: '复古风格',
        promptSuffix: ', retro vintage style, film grain, nostalgic color grading',
        thumbnail: 'linear-gradient(135deg, #c9920e 0%, #8b4513 100%)',
        isPro: true
      },
      {
        id: 'light-shadow',
        name: 'Light & Shadow',
        nameZh: '光影效果',
        promptSuffix: ', dramatic lighting, strong shadows, chiaroscuro effect',
        thumbnail: 'linear-gradient(135deg, #0c0c0c 0%, #f39c12 100%)',
        isPro: true
      }
    ]
  },
  {
    id: 'realistic',
    name: 'Realistic',
    nameZh: '写实风格',
    presets: [
      {
        id: 'photo-realistic',
        name: 'Photo Realistic',
        nameZh: '照片写实',
        promptSuffix: ', photorealistic, 8k uhd, high detail, sharp focus',
        thumbnail: 'linear-gradient(135deg, #3c6382 0%, #82ccdd 100%)',
        isPro: false
      },
      {
        id: 'cinematic',
        name: 'Cinematic',
        nameZh: '电影质感',
        promptSuffix: ', cinematic lighting, film still, anamorphic lens, color grading',
        thumbnail: 'linear-gradient(135deg, #2c3e50 0%, #e74c3c 100%)',
        isPro: false
      },
      {
        id: 'portrait',
        name: 'Portrait',
        nameZh: '人像摄影',
        promptSuffix: ', professional portrait photography, bokeh background, studio lighting',
        thumbnail: 'linear-gradient(135deg, #6c5ce7 0%, #a8e6cf 100%)',
        isPro: true
      }
    ]
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    nameZh: '水彩风格',
    presets: [
      {
        id: 'watercolor-classic',
        name: 'Classic Watercolor',
        nameZh: '经典水彩',
        promptSuffix: ', watercolor painting, soft washes, translucent layers, artistic',
        thumbnail: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
        isPro: false
      },
      {
        id: 'watercolor-splash',
        name: 'Splash',
        nameZh: '泼墨水彩',
        promptSuffix: ', watercolor splash art, vibrant ink splatter, expressive brushwork',
        thumbnail: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        isPro: true
      }
    ]
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    nameZh: '赛博朋克',
    presets: [
      {
        id: 'cyberpunk-neon',
        name: 'Neon City',
        nameZh: '霓虹都市',
        promptSuffix: ', cyberpunk, neon lights, futuristic city, rain-soaked streets',
        thumbnail: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        isPro: false
      },
      {
        id: 'cyberpunk-glitch',
        name: 'Glitch Art',
        nameZh: '故障艺术',
        promptSuffix: ', glitch art, digital distortion, corrupted data aesthetic, RGB shift',
        thumbnail: 'linear-gradient(135deg, #00f260 0%, #0575e6 100%)',
        isPro: true
      }
    ]
  },
  {
    id: 'oil-painting',
    name: 'Oil Painting',
    nameZh: '油画风格',
    presets: [
      {
        id: 'oil-classic',
        name: 'Classic Oil',
        nameZh: '经典油画',
        promptSuffix: ', oil painting, rich textures, impasto technique, fine art masterpiece',
        thumbnail: 'linear-gradient(135deg, #d4a574 0%, #614e3a 100%)',
        isPro: false
      },
      {
        id: 'oil-impressionism',
        name: 'Impressionism',
        nameZh: '印象派',
        promptSuffix: ', impressionist painting, visible brushstrokes, light and color play, Monet style',
        thumbnail: 'linear-gradient(135deg, #f9d423 0%, #ff4e50 100%)',
        isPro: true
      }
    ]
  },
  {
    id: 'sketch',
    name: 'Sketch',
    nameZh: '素描风格',
    presets: [
      {
        id: 'pencil-sketch',
        name: 'Pencil Sketch',
        nameZh: '铅笔素描',
        promptSuffix: ', pencil sketch, hand-drawn, detailed linework, graphite on paper',
        thumbnail: 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)',
        isPro: false
      },
      {
        id: 'charcoal',
        name: 'Charcoal',
        nameZh: '炭笔画',
        promptSuffix: ', charcoal drawing, bold strokes, dramatic shading, textured paper',
        thumbnail: 'linear-gradient(135deg, #434343 0%, #000000 100%)',
        isPro: true
      }
    ]
  },
  {
    id: 'cartoon',
    name: 'Cartoon',
    nameZh: '卡通风格',
    presets: [
      {
        id: 'anime',
        name: 'Anime',
        nameZh: '动漫风',
        promptSuffix: ', anime style, cel shading, vibrant colors, Japanese animation',
        thumbnail: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        isPro: false
      },
      {
        id: 'pixel-art',
        name: 'Pixel Art',
        nameZh: '像素风',
        promptSuffix: ', pixel art style, 16-bit retro game aesthetic, blocky colors',
        thumbnail: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        isPro: true
      }
    ]
  }
];

// ─── Editor Tool Types ────────────────────────────────────────────────────────

export type EditorTool =
  | 'crop'
  | 'rotate'
  | 'filter'
  | 'draw'
  | 'text'
  | 'shape'
  | 'icon'
  | 'mask';

export interface ToolConfig {
  id: EditorTool;
  label: string;
  icon: string;
}

export interface PromptSuggestion {
  category: string;
  prompts: string[];
}

export interface UserPreferences {
  modelId: string;
  width: number;
  height: number;
  steps: number;
  guidance: number;
  batchSize: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  modelId: 'qwen-image',
  width: 1024,
  height: 1024,
  steps: 30,
  guidance: 7.5,
  batchSize: 1
};
