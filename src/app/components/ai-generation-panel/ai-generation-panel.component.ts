import { Component, OnInit, OnDestroy, Output, EventEmitter, Input, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';
import { AiStateService } from '../../services/ai-state.service';
import { PromptSuggestionService } from '../../services/prompt-suggestion.service';
import { PromptEnhanceService } from '../../services/prompt-enhance.service';
import { I18nService } from '../../services/i18n.service';
import {
  AiGeneratedImage,
  AiGenerationRequest,
  GenerationState,
  ModelConfig,
  AI_MODELS,
  StyleCategory,
  ImageStylePreset,
  IMAGE_STYLE_CATEGORIES
} from '../../models/ai-generation.model';

@Component({
  selector: 'app-ai-generation-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-generation-panel.component.html',
  styleUrls: ['./ai-generation-panel.component.scss']
})
export class AiGenerationPanelComponent implements OnInit, OnDestroy {
  @Input() canvasHasImage = false;
  /**
   * Bound provider from the parent so the panel can pull the current canvas
   * image on-demand (used for img2img / enhance flows without duplicating
   * state here).
   */
  @Input() canvasImageProvider: (() => string) | null = null;
  @Output() imageSelected = new EventEmitter<string>();

  /**
   * Hidden `<input type="file">` behind the "Upload image" button on the
   * needs-canvas hint. We drive it programmatically so we can style the
   * visible button with the same Creaition tokens as the rest of the panel.
   */
  @ViewChild('sourceUploadInput') sourceUploadInput?: ElementRef<HTMLInputElement>;

  prompt = '';
  negativePrompt = '';
  width = 512;
  height = 512;
  steps = 30;
  guidance = 7.5;

  generationState: GenerationState = 'idle';
  generatedImages: AiGeneratedImage[] = [];
  error: string | null = null;
  progress = 0;

  suggestions: string[] = [];
  showSuggestions = false;
  activeTab: 'generate' | 'history' | 'favorites' = 'generate';
  showAdvanced = false;

  /** True while a SenseNova rewrite request is in flight. */
  enhancing = false;
  /** Last enhance-prompt error, surfaced next to the input so it doesn't hijack the main error banner. */
  enhanceError: string | null = null;

  readonly i18n = inject(I18nService);
  readonly models: ModelConfig[] = AI_MODELS;
  readonly styleCategories: StyleCategory[] = IMAGE_STYLE_CATEGORIES;

  /** Currently active style category tab */
  activeStyleCategory: StyleCategory = IMAGE_STYLE_CATEGORIES[0];
  /** Currently selected style preset */
  selectedStyle: ImageStylePreset = IMAGE_STYLE_CATEGORIES[0].presets[0];
  /** Whether the style panel is expanded */
  showStylePanel = false;

  private destroy$ = new Subject<void>();
  private promptInput$ = new Subject<string>();

  constructor(
    private aiState: AiStateService,
    private promptService: PromptSuggestionService,
    private promptEnhance: PromptEnhanceService
  ) {}

  ngOnInit(): void {
    this.aiState.generationState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => this.generationState = state);

    this.aiState.generatedImages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(images => this.generatedImages = images);

    this.aiState.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => this.error = error);

    this.aiState.progress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => this.progress = progress);

    // Auto-load newly generated images into the canvas so the user doesn't
    // have to click History → Use for the common case. History still works
    // for reloading older results.
    this.aiState.latestImage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(dataUrl => this.imageSelected.emit(dataUrl));

    this.promptInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.suggestions = this.promptService.searchSuggestions(query);
      this.showSuggestions = this.suggestions.length > 0;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get selectedModel(): ModelConfig {
    return this.aiState.selectedModel;
  }

  get canImg2Img(): boolean {
    return this.canvasHasImage && this.selectedModel.supportsImg2Img;
  }

  get favoriteImages(): AiGeneratedImage[] {
    return this.generatedImages.filter(img => img.isFavorite);
  }

  get isLoading(): boolean {
    return this.generationState === 'loading';
  }

  modelName(id: string | undefined): string {
    if (!id) return '';
    const model = AI_MODELS.find(m => m.id === id);
    return model ? model.name : '';
  }

  onModelChange(modelId: string): void {
    this.aiState.selectModel(modelId);
  }

  onStyleCategoryChange(category: StyleCategory): void {
    this.activeStyleCategory = category;
  }

  selectStyle(preset: ImageStylePreset): void {
    this.selectedStyle = preset;
    this.showStylePanel = false;
  }

  toggleStylePanel(): void {
    this.showStylePanel = !this.showStylePanel;
  }

  get selectedStyleName(): string {
    if (this.selectedStyle.id === 'default-tone') {
      return this.i18n.t('ai.styleDefault');
    }
    return this.i18n.currentLang === 'zh' ? this.selectedStyle.nameZh : this.selectedStyle.name;
  }

  onPromptInput(): void {
    this.promptInput$.next(this.prompt);
  }

  selectSuggestion(suggestion: string): void {
    this.prompt = suggestion;
    this.showSuggestions = false;
  }

  generate(): void {
    if (!this.prompt.trim()) return;

    // Append style suffix to prompt if a non-default style is selected
    let finalPrompt = this.prompt.trim();
    if (this.selectedStyle.promptSuffix) {
      finalPrompt += this.selectedStyle.promptSuffix;
    }

    const request: AiGenerationRequest = {
      prompt: finalPrompt,
      negativePrompt: this.negativePrompt.trim() || undefined,
      width: this.width,
      height: this.height,
      numInferenceSteps: this.steps,
      guidanceScale: this.guidance,
      styleId: this.selectedStyle.id !== 'default-tone' ? this.selectedStyle.id : undefined
    };

    // Img2img: for edit-only models like Qwen-Image-Edit, ModelScope 400s a
    // request without a source image ("Qwen Image Edit requires image
    // upload"). Pull the current canvas contents through the parent-supplied
    // provider so the backend can forward it. The button itself is disabled
    // when `canvasHasImage` is false, so this branch reliably has data.
    if (this.selectedModel.supportsImg2Img && this.canvasHasImage && this.canvasImageProvider) {
      request.sourceImage = this.canvasImageProvider();
    }

    this.aiState.generateImage(request);
  }

  /**
   * True when the Generate button should be disabled: no prompt, already
   * loading, or an edit-model selected without a source image on the canvas.
   * Kept as a getter so the template stays declarative.
   */
  get canGenerate(): boolean {
    if (this.isLoading || !this.prompt.trim()) return false;
    if (this.selectedModel.supportsImg2Img && !this.canvasHasImage) return false;
    return true;
  }

  /** True when the selected model needs a source image the canvas hasn't got yet. */
  get needsCanvasImage(): boolean {
    return this.selectedModel.supportsImg2Img && !this.canvasHasImage;
  }

  /**
   * Opens the native file picker on behalf of the needs-canvas hint. The
   * selected image is emitted through `imageSelected` — same channel as
   * History → Use — so the parent loads it onto the canvas and
   * `canvasHasImage` flips to true.
   */
  uploadSourceImage(): void {
    this.sourceUploadInput?.nativeElement.click();
  }

  onSourceUploadChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
        this.imageSelected.emit(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    // Reset so selecting the same file again still triggers `change`.
    input.value = '';
  }

  useImage(image: AiGeneratedImage): void {
    this.imageSelected.emit(image.imageData);
  }

  toggleFavorite(image: AiGeneratedImage): void {
    this.aiState.toggleFavorite(image.id);
  }

  deleteImage(image: AiGeneratedImage): void {
    this.aiState.deleteImage(image.id);
  }

  clearHistory(): void {
    this.aiState.clearHistory();
  }

  dismissError(): void {
    this.aiState.resetState();
  }

  /**
   * Ask SenseNova to rewrite whatever the user has typed so far into a
   * richer prompt. The result overwrites the current textarea contents so
   * the user can still edit before hitting Generate. Empty inputs and
   * in-flight requests are a no-op.
   */
  enhancePromptWithAi(): void {
    const source = this.prompt.trim();
    if (!source || this.enhancing) return;
    this.enhancing = true;
    this.enhanceError = null;
    this.promptEnhance.enhance(source)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.enhancing = false)
      )
      .subscribe({
        next: (enhanced) => this.prompt = enhanced,
        error: (err: Error) => this.enhanceError = err.message
      });
  }

  dismissEnhanceError(): void {
    this.enhanceError = null;
  }
}
