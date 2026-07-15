import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AiStateService } from './ai-state.service';
import { AiImageService } from './ai-image.service';
import { AiPreferencesService } from './ai-preferences.service';
import { of, throwError } from 'rxjs';
import { AiGenerationRequest, AI_MODELS } from '../models/ai-generation.model';

describe('AiStateService', () => {
  let service: AiStateService;
  let aiImageServiceSpy: jasmine.SpyObj<AiImageService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AiImageService', [
      'generateImage', 'editImage', 'enhanceImage', 'batchGenerate'
    ]);

    TestBed.configureTestingModule({
      providers: [
        AiStateService,
        AiPreferencesService,
        { provide: AiImageService, useValue: spy },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    localStorage.removeItem('creaition_ai_history');
    localStorage.removeItem('creaition_ai_favorites');
    localStorage.removeItem('creaition_ai_preferences');

    service = TestBed.inject(AiStateService);
    aiImageServiceSpy = TestBed.inject(AiImageService) as jasmine.SpyObj<AiImageService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('has idle generation state', () => {
      expect(service.currentState.generationState).toBe('idle');
    });
    it('has no images', () => {
      expect(service.currentState.generatedImages).toEqual([]);
    });
    it('has no error', () => {
      expect(service.currentState.error).toBeNull();
    });
    it('defaults to a valid model', () => {
      expect(AI_MODELS.map(m => m.id)).toContain(service.selectedModel.id);
    });
  });

  describe('selectModel', () => {
    it('switches to a known model id', () => {
      service.selectModel('sd15');
      expect(service.selectedModel.id).toBe('sd15');
    });
    it('ignores unknown model ids', () => {
      const before = service.selectedModel.id;
      service.selectModel('does-not-exist');
      expect(service.selectedModel.id).toBe(before);
    });
  });

  describe('generateImage', () => {
    const mockRequest: AiGenerationRequest = { prompt: 'A sunset' };

    it('sets success state after generation resolves', () => {
      aiImageServiceSpy.generateImage.and.returnValue(of('data:image/png;base64,abc'));
      service.generateImage(mockRequest);
      expect(service.currentState.generationState).toBe('success');
    });

    it('appends the generated image to history with modelId tag', () => {
      aiImageServiceSpy.generateImage.and.returnValue(of('data:image/png;base64,abc'));
      service.generateImage(mockRequest);

      expect(service.currentState.generatedImages.length).toBe(1);
      const img = service.currentState.generatedImages[0];
      expect(img.prompt).toBe('A sunset');
      expect(img.imageData).toBe('data:image/png;base64,abc');
      expect(img.modelId).toBeDefined();
    });

    it('sets error state on failure and preserves the message', () => {
      aiImageServiceSpy.generateImage.and.returnValue(throwError(() => new Error('Network error')));
      service.generateImage(mockRequest);

      expect(service.currentState.generationState).toBe('error');
      expect(service.currentState.error).toBe('Network error');
    });

    it('routes to editImage when a source image is provided AND the model supports img2img', () => {
      aiImageServiceSpy.editImage.and.returnValue(of('data:image/png;base64,edited'));
      service.selectModel('sdxl'); // supports img2img
      service.generateImage({ prompt: 'x', sourceImage: 'data:image/png;base64,src' });

      expect(aiImageServiceSpy.editImage).toHaveBeenCalled();
      expect(aiImageServiceSpy.generateImage).not.toHaveBeenCalled();
    });

    it('records lastRequest / lastModelId so retry can replay it', () => {
      aiImageServiceSpy.generateImage.and.returnValue(of('data:image/png;base64,abc'));
      service.generateImage(mockRequest);

      expect(service.currentState.lastRequest?.prompt).toBe('A sunset');
      expect(service.currentState.lastModelId).toBe(service.selectedModel.id);
    });
  });

  describe('retryLast', () => {
    it('re-invokes the last request through the service', () => {
      aiImageServiceSpy.generateImage.and.returnValue(of('data:image/png;base64,abc'));
      service.generateImage({ prompt: 'first attempt' });

      aiImageServiceSpy.generateImage.calls.reset();
      aiImageServiceSpy.generateImage.and.returnValue(of('data:image/png;base64,second'));
      service.retryLast();

      expect(aiImageServiceSpy.generateImage).toHaveBeenCalledTimes(1);
      expect(service.currentState.generatedImages.length).toBe(2);
    });

    it('is a no-op when there is no last request', () => {
      service.retryLast();
      expect(aiImageServiceSpy.generateImage).not.toHaveBeenCalled();
    });
  });

  describe('enhanceImage', () => {
    it('rejects the request when the current model does not support img2img', () => {
      // Force a model that doesn't support img2img by monkeypatching state.
      spyOnProperty(service, 'selectedModel', 'get').and.returnValue({
        id: 'fake', name: 'F', endpoint: '', description: '',
        supportsImg2Img: false, supportsNegativePrompt: false,
        defaultSteps: 20, defaultGuidance: 7, maxWidth: 512, maxHeight: 512
      });
      service.enhanceImage('data:image/png;base64,x');
      expect(service.currentState.error).toContain('does not support');
      expect(aiImageServiceSpy.enhanceImage).not.toHaveBeenCalled();
    });

    it('invokes enhanceImage on the service for supporting models', () => {
      aiImageServiceSpy.enhanceImage.and.returnValue(of('data:image/png;base64,enhanced'));
      service.selectModel('sdxl');
      service.enhanceImage('data:image/png;base64,src');
      expect(aiImageServiceSpy.enhanceImage).toHaveBeenCalled();
      expect(service.currentState.generatedImages[0].tags).toContain('enhanced');
    });
  });

  describe('toggleFavorite', () => {
    it('flips favourite state and mirrors into favorites list', () => {
      aiImageServiceSpy.generateImage.and.returnValue(of('data:image/png;base64,test'));
      service.generateImage({ prompt: 'test' });
      const id = service.currentState.generatedImages[0].id;

      service.toggleFavorite(id);
      expect(service.currentState.generatedImages[0].isFavorite).toBeTrue();
      expect(service.currentState.favorites.length).toBe(1);

      service.toggleFavorite(id);
      expect(service.currentState.favorites.length).toBe(0);
    });
  });

  describe('clearHistory', () => {
    it('empties both history and favourites', () => {
      aiImageServiceSpy.generateImage.and.returnValue(of('data:image/png;base64,test'));
      service.generateImage({ prompt: 'a' });
      service.generateImage({ prompt: 'b' });
      service.clearHistory();
      expect(service.currentState.generatedImages).toEqual([]);
      expect(service.currentState.favorites).toEqual([]);
    });
  });

  describe('resetState', () => {
    it('returns to idle without touching history', () => {
      aiImageServiceSpy.generateImage.and.returnValue(throwError(() => new Error('fail')));
      service.generateImage({ prompt: 'x' });
      expect(service.currentState.generationState).toBe('error');

      service.resetState();
      expect(service.currentState.generationState).toBe('idle');
      expect(service.currentState.error).toBeNull();
    });
  });

  describe('localStorage persistence', () => {
    it('writes generated images to localStorage', () => {
      aiImageServiceSpy.generateImage.and.returnValue(of('data:image/png;base64,stored'));
      service.generateImage({ prompt: 'persist test' });

      const stored = localStorage.getItem('creaition_ai_history');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.length).toBe(1);
      expect(parsed[0].prompt).toBe('persist test');
    });
  });
});
