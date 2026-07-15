import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AiGenerationPanelComponent } from './ai-generation-panel.component';
import { AiStateService } from '../../services/ai-state.service';
import { AiImageService } from '../../services/ai-image.service';
import { of } from 'rxjs';
import { AI_MODELS } from '../../models/ai-generation.model';

describe('AiGenerationPanelComponent', () => {
  let component: AiGenerationPanelComponent;
  let fixture: ComponentFixture<AiGenerationPanelComponent>;
  let aiImageServiceSpy: jasmine.SpyObj<AiImageService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('AiImageService', [
      'generateImage', 'editImage', 'enhanceImage', 'batchGenerate'
    ]);
    spy.generateImage.and.returnValue(of('data:image/png;base64,test'));

    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AiGenerationPanelComponent, NoopAnimationsModule],
      providers: [
        AiStateService,
        { provide: AiImageService, useValue: spy },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    aiImageServiceSpy = TestBed.inject(AiImageService) as jasmine.SpyObj<AiImageService>;
    fixture = TestBed.createComponent(AiGenerationPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes the curated model catalogue', () => {
    expect(component.models.length).toBe(AI_MODELS.length);
  });

  it('starts on the generate tab', () => {
    expect(component.activeTab).toBe('generate');
  });

  it('does nothing on empty prompt when Generate is clicked', () => {
    component.prompt = '   ';
    component.generate();
    expect(aiImageServiceSpy.generateImage).not.toHaveBeenCalled();
  });

  it('kicks off a generation for a non-empty prompt', () => {
    component.prompt = 'a cat on a beach';
    component.generate();
    expect(aiImageServiceSpy.generateImage).toHaveBeenCalled();
  });

  it('canImg2Img is false when the canvas has no image', () => {
    component.canvasHasImage = false;
    expect(component.canImg2Img).toBeFalse();
  });

  it('modelName resolves the human-readable name for a known id', () => {
    expect(component.modelName('sdxl')).toContain('Stable Diffusion XL');
  });

  it('modelName returns empty string for undefined ids', () => {
    expect(component.modelName(undefined)).toBe('');
  });

  it('emits imageSelected when a history item is picked', () => {
    spyOn(component.imageSelected, 'emit');
    const fakeImg = {
      id: '1', prompt: 'x', imageData: 'data:image/png;base64,abc',
      timestamp: 0, isFavorite: false, modelId: 'sdxl', parameters: { prompt: 'x' }
    };
    component.useImage(fakeImg);
    expect(component.imageSelected.emit).toHaveBeenCalledWith('data:image/png;base64,abc');
  });
});
