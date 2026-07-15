import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AiImageService } from './ai-image.service';
import { AiGenerationRequest, AI_MODELS, ModelConfig } from '../models/ai-generation.model';
import { environment } from '../../environments/environment';

describe('AiImageService', () => {
  let service: AiImageService;
  let httpMock: HttpTestingController;
  const sdxl: ModelConfig = AI_MODELS.find(m => m.id === 'sdxl')!;
  const proxyUrl = environment.apiProxyUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AiImageService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(AiImageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateImage', () => {
    const mockRequest: AiGenerationRequest = {
      prompt: 'A beautiful sunset over mountains',
      width: 512,
      height: 512,
      numInferenceSteps: 30,
      guidanceScale: 7.5
    };

    it('POSTs the proxy URL with a body that carries the target endpoint and shaped params', () => {
      service.generateImage(mockRequest, sdxl).subscribe();

      const req = httpMock.expectOne(proxyUrl);
      expect(req.request.method).toBe('POST');
      // No client-side Authorization header — the token lives on the server.
      expect(req.request.headers.get('Authorization')).toBeNull();

      const body = req.request.body;
      expect(body.endpoint).toBe(sdxl.endpoint);
      expect(body.inputs).toBe(mockRequest.prompt);
      expect(body.parameters.width).toBe(512);
      expect(body.parameters.height).toBe(512);
      expect(body.parameters.num_inference_steps).toBe(30);
      expect(body.parameters.guidance_scale).toBe(7.5);

      req.flush(new Blob(['fake-image-data'], { type: 'image/png' }));
    });

    it('includes negative_prompt when the model supports it', () => {
      const req: AiGenerationRequest = { ...mockRequest, negativePrompt: 'blurry' };
      service.generateImage(req, sdxl).subscribe();

      const httpReq = httpMock.expectOne(proxyUrl);
      expect(httpReq.request.body.parameters.negative_prompt).toBe('blurry');
      httpReq.flush(new Blob(['x'], { type: 'image/png' }));
    });

    it('omits negative_prompt when the model does not support it', () => {
      const qwen = AI_MODELS.find(m => m.id === 'qwen-edit')!;
      const req: AiGenerationRequest = { ...mockRequest, negativePrompt: 'blurry' };
      service.generateImage(req, qwen).subscribe();

      const httpReq = httpMock.expectOne(proxyUrl);
      expect(httpReq.request.body.endpoint).toBe(qwen.endpoint);
      expect(httpReq.request.body.parameters?.negative_prompt).toBeUndefined();
      httpReq.flush(new Blob(['x'], { type: 'image/png' }));
    });

    it('omits parameters object entirely when no options given', () => {
      service.generateImage({ prompt: 'only prompt' }, sdxl).subscribe();

      const httpReq = httpMock.expectOne(proxyUrl);
      expect(httpReq.request.body.inputs).toBe('only prompt');
      expect(httpReq.request.body.parameters).toBeUndefined();
      httpReq.flush(new Blob(['x'], { type: 'image/png' }));
    });

    it('converts blob response to a base64 data URL', (done) => {
      service.generateImage(mockRequest, sdxl).subscribe(result => {
        expect(result).toContain('data:');
        done();
      });
      const req = httpMock.expectOne(proxyUrl);
      req.flush(new Blob(['fake'], { type: 'image/png' }));
    });

    it('surfaces a friendly message on 401', (done) => {
      service.generateImage(mockRequest, sdxl).subscribe({
        error: (err) => {
          expect(err.message).toContain('Invalid API token');
          done();
        }
      });
      httpMock.expectOne(proxyUrl).error(new ProgressEvent('error'), { status: 401, statusText: 'Unauthorized' });
    });

    it('surfaces a friendly message on network error', (done) => {
      service.generateImage(mockRequest, sdxl).subscribe({
        error: (err) => {
          expect(err.message).toContain('Network error');
          done();
        }
      });
      httpMock.expectOne(proxyUrl).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    });
  });

  describe('editImage', () => {
    it('strips the data URL prefix from the source image and tags the target endpoint', () => {
      const sourceImage = 'data:image/png;base64,iVBORw0KGgo=';
      const request: AiGenerationRequest = { prompt: 'make it brighter' };

      service.editImage(sourceImage, request, sdxl).subscribe();

      const req = httpMock.expectOne(proxyUrl);
      expect(req.request.body.endpoint).toBe(sdxl.endpoint);
      expect(req.request.body.inputs).toBe('make it brighter');
      expect(req.request.body.image).toBe('iVBORw0KGgo=');
      req.flush(new Blob(['result'], { type: 'image/png' }));
    });
  });

  describe('enhanceImage', () => {
    it('routes through editImage with a boosted prompt', () => {
      service.enhanceImage('data:image/png;base64,abc', sdxl).subscribe();
      const req = httpMock.expectOne(proxyUrl);
      expect(req.request.body.inputs).toContain('ultra-detailed');
      expect(req.request.body.image).toBe('abc');
      req.flush(new Blob(['enhanced'], { type: 'image/png' }));
    });
  });
});
