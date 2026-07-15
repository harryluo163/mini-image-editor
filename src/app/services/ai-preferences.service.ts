import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AI_MODELS, ModelConfig, UserPreferences, DEFAULT_PREFERENCES } from '../models/ai-generation.model';

const STORAGE_KEY = 'creaition_ai_preferences';

@Injectable({
  providedIn: 'root'
})
export class AiPreferencesService {
  private readonly subject = new BehaviorSubject<UserPreferences>(this.load());

  readonly preferences$: Observable<UserPreferences> = this.subject.asObservable();

  get snapshot(): UserPreferences {
    return this.subject.value;
  }

  get preferences(): UserPreferences {
    return this.subject.value;
  }

  getSelectedModel(): ModelConfig {
    return AI_MODELS.find(m => m.id === this.subject.value.modelId) || AI_MODELS[0];
  }

  setModelId(id: string): void {
    const found = AI_MODELS.find(m => m.id === id);
    if (found) {
      this.update({ modelId: id });
    }
  }

  update(partial: Partial<UserPreferences>): void {
    const next = { ...this.subject.value, ...partial };
    this.subject.next(next);
    this.persist(next);
  }

  reset(): void {
    this.subject.next({ ...DEFAULT_PREFERENCES });
    this.persist(DEFAULT_PREFERENCES);
  }

  private load(): UserPreferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PREFERENCES };
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  private persist(prefs: UserPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch { /* ignore */ }
  }
}
