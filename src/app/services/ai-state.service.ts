import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AiState,
  AiGeneratedImage,
  AiGenerationRequest,
  ModelConfig,
  AI_MODELS
} from '../models/ai-generation.model';
import { AiImageService } from './ai-image.service';
import { AiPreferencesService } from './ai-preferences.service';

const STORAGE_KEY_HISTORY = 'creaition_ai_history';
const STORAGE_KEY_FAVORITES = 'creaition_ai_favorites';

@Injectable({
  providedIn: 'root'
})
export class AiStateService {
  private readonly initialState: AiState = {
    generationState: 'idle',
    currentPrompt: '',
    generatedImages: [],
    favorites: [],
    error: null,
    progress: 0,
    lastRequest: null,
    lastModelId: null
  };

  private stateSubject = new BehaviorSubject<AiState>(this.initialState);

  state$ = this.stateSubject.asObservable();
  generationState$ = this.state$.pipe(map(s => s.generationState));
  generatedImages$ = this.state$.pipe(map(s => s.generatedImages));
  favorites$ = this.state$.pipe(map(s => s.favorites));
  error$ = this.state$.pipe(map(s => s.error));
  progress$ = this.state$.pipe(map(s => s.progress));

  /**
   * Emits the data URL of a freshly generated image so consumers (the AI
   * panel) can auto-load it into the canvas without waiting for the user
   * to click "Use" in History. Fires exactly once per successful
   * `generateImage()` call; not driven by `generatedImages$` (which also
   * fires on load-from-storage and toggle-favorite).
   */
  private latestImageSubject = new Subject<string>();
  latestImage$ = this.latestImageSubject.asObservable();

  /**
   * Subscription to the in-flight generation Observable. Held so a Cancel
   * click can unsubscribe — that tears down the polling loop in
   * `AiImageService.pollTask`.
   */
  private currentGeneration: Subscription | null = null;
  private currentProgressInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private aiImageService: AiImageService,
    private prefsService: AiPreferencesService
  ) {
    this.loadFromStorage();
  }

  get currentState(): AiState {
    return this.stateSubject.value;
  }

  get selectedModel(): ModelConfig {
    return this.prefsService.getSelectedModel();
  }

  selectModel(id: string): void {
    const found = AI_MODELS.find(m => m.id === id);
    if (found) {
      this.prefsService.setModelId(id);
    }
  }

  generateImage(request: AiGenerationRequest): void {
    const model = this.selectedModel;

    // Cancel any prior in-flight generation before starting a new one.
    this.stopInFlight();

    this.updateState({
      generationState: 'loading',
      error: null,
      progress: 0,
      lastRequest: request,
      lastModelId: model.id
    });

    this.currentProgressInterval = setInterval(() => {
      const current = this.currentState.progress;
      if (current < 90) {
        this.updateState({ progress: current + Math.random() * 15 });
      }
    }, 500);

    // Route to editImage if sourceImage is provided and model supports it
    const obs = (request.sourceImage && model.supportsImg2Img)
      ? this.aiImageService.editImage(request.sourceImage, request, model)
      : this.aiImageService.generateImage(request, model);

    this.currentGeneration = obs.subscribe({
      next: (imageData: string) => {
        this.clearProgressInterval();
        this.currentGeneration = null;
        // Defensive: an earlier iteration of the polling code briefly stored
        // task-id JSON as if it were an image, poisoning History with
        // `data:application/json;base64,...` entries that render broken.
        // Reject anything that isn't a real image data URL so future runs
        // stay clean.
        if (!AiStateService.isImageDataUrl(imageData)) {
          this.updateState({
            generationState: 'error',
            error: `Backend returned non-image data (${imageData.slice(0, 60)}…). Please retry.`,
            progress: 0
          });
          return;
        }
        const newImage: AiGeneratedImage = {
          id: this.generateId(),
          prompt: request.prompt,
          imageData,
          timestamp: Date.now(),
          isFavorite: false,
          modelId: model.id,
          parameters: request
        };

        const updatedImages = [newImage, ...this.currentState.generatedImages];
        this.updateState({
          generationState: 'success',
          generatedImages: updatedImages,
          progress: 100
        });
        this.saveToStorage();
        // Nudge listeners (AI panel) so the fresh image auto-loads into the
        // canvas without the user having to click History → Use.
        this.latestImageSubject.next(imageData);
      },
      error: (error: Error) => {
        this.clearProgressInterval();
        this.currentGeneration = null;
        this.updateState({
          generationState: 'error',
          error: error.message,
          progress: 0
        });
      }
    });
  }

  /**
   * User-initiated stop. Unsubscribes the poll loop (ModelScope keeps the
   * task running server-side but we no longer wait for it) and resets the
   * UI to idle. Safe to call when nothing is in-flight.
   */
  cancelGeneration(): void {
    if (!this.currentGeneration && !this.currentProgressInterval) return;
    this.stopInFlight();
    this.updateState({
      generationState: 'idle',
      error: null,
      progress: 0
    });
  }

  private stopInFlight(): void {
    if (this.currentGeneration) {
      this.currentGeneration.unsubscribe();
      this.currentGeneration = null;
    }
    this.clearProgressInterval();
  }

  private clearProgressInterval(): void {
    if (this.currentProgressInterval) {
      clearInterval(this.currentProgressInterval);
      this.currentProgressInterval = null;
    }
  }

  retryLast(): void {
    const { lastRequest, lastModelId } = this.currentState;
    if (!lastRequest) return;

    if (lastModelId) {
      this.selectModel(lastModelId);
    }
    this.generateImage(lastRequest);
  }

  enhanceImage(imageData: string): void {
    const model = this.selectedModel;

    if (!model.supportsImg2Img) {
      this.updateState({
        generationState: 'error',
        error: `Model "${model.name}" does not support image-to-image enhancement.`
      });
      return;
    }

    this.updateState({
      generationState: 'loading',
      error: null,
      progress: 0
    });

    this.aiImageService.enhanceImage(imageData, model).subscribe({
      next: (result: string) => {
        const newImage: AiGeneratedImage = {
          id: this.generateId(),
          prompt: 'Enhanced image',
          imageData: result,
          timestamp: Date.now(),
          isFavorite: false,
          modelId: model.id,
          parameters: { prompt: 'enhance' },
          tags: ['enhanced']
        };

        const updatedImages = [newImage, ...this.currentState.generatedImages];
        this.updateState({
          generationState: 'success',
          generatedImages: updatedImages,
          progress: 100
        });
        this.saveToStorage();
      },
      error: (error: Error) => {
        this.updateState({
          generationState: 'error',
          error: error.message,
          progress: 0
        });
      }
    });
  }

  toggleFavorite(imageId: string): void {
    const images = this.currentState.generatedImages.map(img =>
      img.id === imageId ? { ...img, isFavorite: !img.isFavorite } : img
    );
    const favorites = images.filter(img => img.isFavorite);
    this.updateState({ generatedImages: images, favorites });
    this.saveToStorage();
  }

  deleteImage(imageId: string): void {
    const images = this.currentState.generatedImages.filter(img => img.id !== imageId);
    const favorites = images.filter(img => img.isFavorite);
    this.updateState({ generatedImages: images, favorites });
    this.saveToStorage();
  }

  clearHistory(): void {
    this.updateState({ generatedImages: [], favorites: [] });
    this.saveToStorage();
  }

  resetState(): void {
    this.updateState({
      generationState: 'idle',
      error: null,
      progress: 0
    });
  }

  private updateState(partial: Partial<AiState>): void {
    this.stateSubject.next({ ...this.currentState, ...partial });
  }

  private generateId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(this.currentState.generatedImages));
      localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(this.currentState.favorites));
    } catch { /* ignore */ }
  }

  private loadFromStorage(): void {
    try {
      const history = localStorage.getItem(STORAGE_KEY_HISTORY);
      const favorites = localStorage.getItem(STORAGE_KEY_FAVORITES);
      if (history) {
        const parsed: AiGeneratedImage[] = JSON.parse(history);
        // Strip out corrupted entries where `imageData` isn't a real image
        // data URL (see the note in generateImage()'s success branch).
        const clean = Array.isArray(parsed)
          ? parsed.filter(img => img && AiStateService.isImageDataUrl(img.imageData))
          : [];
        this.updateState({ generatedImages: clean });
        // Persist the cleaned list so this migration only happens once.
        if (Array.isArray(parsed) && clean.length !== parsed.length) {
          this.saveToStorage();
        }
      }
      if (favorites) {
        const parsed: AiGeneratedImage[] = JSON.parse(favorites);
        const clean = Array.isArray(parsed)
          ? parsed.filter(img => img && AiStateService.isImageDataUrl(img.imageData))
          : [];
        this.updateState({ favorites: clean });
      }
    } catch { /* ignore */ }
  }

  /** True for data URLs whose MIME starts with `image/` (png, jpeg, webp, ...). */
  private static isImageDataUrl(s: unknown): boolean {
    return typeof s === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(s);
  }
}
