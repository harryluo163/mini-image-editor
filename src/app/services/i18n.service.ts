import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Language = 'en' | 'zh';

const STORAGE_KEY = 'creaition-editor-lang';

const translations: Record<Language, Record<string, string>> = {
  en: {
    // App header
    'app.title': 'Creaition Editor',
    'app.ai': 'AI',
    'app.language': 'EN',

    // Toolbar
    'toolbar.tools': 'Tools',
    'toolbar.actions': 'Actions',
    'toolbar.file': 'File',
    'toolbar.crop': 'Crop',
    'toolbar.rotate': 'Rotate',
    'toolbar.draw': 'Draw',
    'toolbar.text': 'Text',
    'toolbar.shape': 'Shape',
    'toolbar.filter': 'Filter',
    'toolbar.undo': 'Undo',
    'toolbar.redo': 'Redo',
    'toolbar.clear': 'Clear',
    'toolbar.import': 'Import',
    'toolbar.export': 'Export',

    // Properties panel
    'props.selectTool': 'Select a tool to see its properties',
    'props.drawSettings': 'Draw Settings',
    'props.color': 'Color',
    'props.brushWidth': 'Brush Width',
    'props.filters': 'Filters',
    'props.grayscale': 'Grayscale',
    'props.sepia': 'Sepia',
    'props.invert': 'Invert',
    'props.blur': 'Blur',
    'props.sharpen': 'Sharpen',
    'props.textSettings': 'Text Settings',
    'props.textHint': 'Click on the canvas to drop a text box, then double-click to edit.',
    'props.shapeSettings': 'Shape Settings',
    'props.shapeHint': 'Pick a shape, then drag on the canvas to draw it.',
    'props.shape': 'Shape',
    'props.rectangle': 'Rectangle',
    'props.circle': 'Circle',
    'props.triangle': 'Triangle',
    'props.strokeWidth': 'Stroke width',
    'props.crop': 'Crop',
    'props.cropHint': 'Drag on the canvas to select the crop area, then apply.',
    'props.applyCrop': 'Apply Crop',
    'props.cancel': 'Cancel',
    'props.rotate': 'Rotate',
    'props.rotateHint': 'Rotate the image in 90° increments.',
    'props.rotateLeft': '⟲ 90° Left',
    'props.rotateRight': '⟳ 90° Right',

    // AI panel
    'ai.title': 'AI Studio',
    'ai.model': 'Model',
    'ai.generate': 'Generate',
    'ai.history': 'History',
    'ai.favorites': 'Favorites',
    'ai.prompt': 'Prompt',
    'ai.promptPlaceholder': 'Describe the image you want to generate...',
    'ai.img2img': 'Use canvas as source (img2img)',
    'ai.img2imgHint': 'Load or generate an image first to enable img2img.',
    'ai.img2imgNoSupport': "The selected model doesn't support img2img.",
    'ai.showAdvanced': 'Show Advanced Settings',
    'ai.hideAdvanced': 'Hide Advanced Settings',
    'ai.negativePrompt': 'Negative Prompt',
    'ai.negativePromptPlaceholder': 'What to avoid...',
    'ai.size': 'Size',
    'ai.steps': 'Steps',
    'ai.guidance': 'Guidance',
    'ai.batch': 'Batch',
    'ai.batchHint': 'Batch varies guidance per item for diverse results.',
    'ai.image': 'image',
    'ai.images': 'images',
    'ai.generating': 'Generating',
    'ai.enhance': '✨ Enhance',
    'ai.retry': 'Retry',
    'ai.dismiss': 'Dismiss',
    'ai.noImages': 'No images generated yet',
    'ai.clearHistory': 'Clear All History',
    'ai.noFavorites': 'No favorite images yet',
    'ai.use': 'Use',
    'ai.removeFavorite': 'Remove from favorites',
    'ai.addFavorite': 'Add to favorites',
    'ai.deleteImage': 'Delete image',
    'ai.max': 'max',
    'ai.style': 'Image Style',
    'ai.styleDefault': 'Default',
    'ai.generateImage': 'Generate Image',
    'ai.uploadImage': 'Upload image',
    'ai.needsCanvasHint': 'edits an existing image. Load or generate one first.',
    'ai.clearAll': 'Clear All',
    'ai.enhancing': 'Enhancing...',
    'ai.enhanceHint': 'Improve prompt with AI',

    // Image editor overlay
    'editor.generating': 'Generating\u2026',
    'editor.cancel': 'Cancel'
  },
  zh: {
    // App header
    'app.title': 'Creaition 编辑器',
    'app.ai': 'AI',
    'app.language': '中',

    // Toolbar
    'toolbar.tools': '工具',
    'toolbar.actions': '操作',
    'toolbar.file': '文件',
    'toolbar.crop': '裁剪',
    'toolbar.rotate': '旋转',
    'toolbar.draw': '画笔',
    'toolbar.text': '文本',
    'toolbar.shape': '形状',
    'toolbar.filter': '滤镜',
    'toolbar.undo': '撤销',
    'toolbar.redo': '重做',
    'toolbar.clear': '清空',
    'toolbar.import': '导入',
    'toolbar.export': '导出',

    // Properties panel
    'props.selectTool': '选择工具查看其属性',
    'props.drawSettings': '画笔设置',
    'props.color': '颜色',
    'props.brushWidth': '画笔宽度',
    'props.filters': '滤镜',
    'props.grayscale': '灰度',
    'props.sepia': '复古',
    'props.invert': '反转',
    'props.blur': '模糊',
    'props.sharpen': '锐化',
    'props.textSettings': '文本设置',
    'props.textHint': '在画布上单击添加文本框，双击文本框即可编辑内容。',
    'props.shapeSettings': '形状设置',
    'props.shapeHint': '选择形状，然后在画布上拖动绘制。',
    'props.shape': '形状',
    'props.rectangle': '矩形',
    'props.circle': '圆形',
    'props.triangle': '三角形',
    'props.strokeWidth': '描边宽度',
    'props.crop': '裁剪',
    'props.cropHint': '在画布上拖动选择裁剪区域，然后应用。',
    'props.applyCrop': '应用裁剪',
    'props.cancel': '取消',
    'props.rotate': '旋转',
    'props.rotateHint': '以90°为增量旋转图像。',
    'props.rotateLeft': '⟲ 左旋90°',
    'props.rotateRight': '⟳ 右旋90°',

    // AI panel
    'ai.title': 'AI 工作室',
    'ai.model': '模型',
    'ai.generate': '生成',
    'ai.history': '历史',
    'ai.favorites': '收藏',
    'ai.prompt': '提示词',
    'ai.promptPlaceholder': '描述你想生成的图像...',
    'ai.img2img': '使用画布作为来源 (图生图)',
    'ai.img2imgHint': '先加载或生成图像以启用图生图。',
    'ai.img2imgNoSupport': '所选模型不支持图生图。',
    'ai.showAdvanced': '显示高级设置',
    'ai.hideAdvanced': '隐藏高级设置',
    'ai.negativePrompt': '负向提示词',
    'ai.negativePromptPlaceholder': '要避免的内容...',
    'ai.size': '尺寸',
    'ai.steps': '步数',
    'ai.guidance': '引导强度',
    'ai.batch': '批量',
    'ai.batchHint': '批量生成通过变化引导值来获得多样化结果。',
    'ai.image': '张',
    'ai.images': '张',
    'ai.generating': '生成中',
    'ai.enhance': '✨ 增强',
    'ai.retry': '重试',
    'ai.dismiss': '关闭',
    'ai.noImages': '还没有生成的图像',
    'ai.clearHistory': '清空所有历史',
    'ai.noFavorites': '还没有收藏的图像',
    'ai.use': '使用',
    'ai.removeFavorite': '取消收藏',
    'ai.addFavorite': '添加到收藏',
    'ai.deleteImage': '删除图像',
    'ai.max': '最大',
    'ai.style': '画面风格',
    'ai.styleDefault': '默认',
    'ai.generateImage': '生成图像',
    'ai.uploadImage': '上传图片',
    'ai.needsCanvasHint': '需要编辑现有图像。请先加载或生成一张图片。',
    'ai.clearAll': '清空全部',
    'ai.enhancing': '增强中...',
    'ai.enhanceHint': '用AI优化提示词',

    // Image editor overlay
    'editor.generating': '生成中\u2026',
    'editor.cancel': '取消'
  }
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private langSubject: BehaviorSubject<Language>;
  lang$!: ReturnType<BehaviorSubject<Language>['asObservable']>;

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    const initial: Language = saved === 'zh' || saved === 'en' ? saved : 'en';
    this.langSubject = new BehaviorSubject<Language>(initial);
    this.lang$ = this.langSubject.asObservable();
  }

  get currentLang(): Language {
    return this.langSubject.value;
  }

  switchLanguage(lang: Language): void {
    this.langSubject.next(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  toggleLanguage(): void {
    const next: Language = this.currentLang === 'en' ? 'zh' : 'en';
    this.switchLanguage(next);
  }

  t(key: string): string {
    return translations[this.currentLang][key] ?? key;
  }
}
