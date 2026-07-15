import { TestBed } from '@angular/core/testing';
import { AiPreferencesService } from './ai-preferences.service';
import { DEFAULT_PREFERENCES } from '../models/ai-generation.model';

describe('AiPreferencesService', () => {
  let service: AiPreferencesService;
  const STORAGE_KEY = 'creaition_ai_preferences';

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [AiPreferencesService] });
    service = TestBed.inject(AiPreferencesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts with defaults when localStorage is empty', () => {
    expect(service.snapshot).toEqual(DEFAULT_PREFERENCES);
  });

  it('persists updates to localStorage', () => {
    service.update({ width: 1024, height: 1024 });

    expect(service.snapshot.width).toBe(1024);
    expect(service.snapshot.height).toBe(1024);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.width).toBe(1024);
    expect(stored.height).toBe(1024);
  });

  it('rehydrates on construction from persisted values', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PREFERENCES, modelId: 'sd15', steps: 45 }));
    // Re-inject so constructor reads the stored value.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [AiPreferencesService] });
    const reloaded = TestBed.inject(AiPreferencesService);

    expect(reloaded.snapshot.modelId).toBe('sd15');
    expect(reloaded.snapshot.steps).toBe(45);
  });

  it('merges partial persisted state with defaults (forward-compatible)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ width: 768 }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [AiPreferencesService] });
    const reloaded = TestBed.inject(AiPreferencesService);

    expect(reloaded.snapshot.width).toBe(768);
    expect(reloaded.snapshot.height).toBe(DEFAULT_PREFERENCES.height);
    expect(reloaded.snapshot.modelId).toBe(DEFAULT_PREFERENCES.modelId);
  });

  it('reset() restores defaults', () => {
    service.update({ width: 1024, steps: 50 });
    service.reset();
    expect(service.snapshot).toEqual(DEFAULT_PREFERENCES);
  });

  it('emits new value via preferences$', (done) => {
    service.preferences$.subscribe(prefs => {
      if (prefs.batchSize === 3) {
        expect(prefs.batchSize).toBe(3);
        done();
      }
    });
    service.update({ batchSize: 3 });
  });
});
