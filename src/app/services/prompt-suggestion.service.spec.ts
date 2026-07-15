import { TestBed } from '@angular/core/testing';
import { PromptSuggestionService } from './prompt-suggestion.service';

describe('PromptSuggestionService', () => {
  let service: PromptSuggestionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PromptSuggestionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAllSuggestions', () => {
    it('should return all suggestion categories', () => {
      const suggestions = service.getAllSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBeDefined();
      expect(suggestions[0].prompts).toBeDefined();
      expect(suggestions[0].prompts.length).toBeGreaterThan(0);
    });
  });

  describe('getCategories', () => {
    it('should return category names', () => {
      const categories = service.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('Landscape');
      expect(categories).toContain('Abstract');
      expect(categories).toContain('Architecture');
      expect(categories).toContain('Portrait');
      expect(categories).toContain('Style Transfer');
    });
  });

  describe('getSuggestionsByCategory', () => {
    it('should return prompts for a valid category', () => {
      const prompts = service.getSuggestionsByCategory('Landscape');
      expect(prompts.length).toBeGreaterThan(0);
      expect(prompts[0]).toContain('mountain');
    });

    it('should return empty array for invalid category', () => {
      const prompts = service.getSuggestionsByCategory('NonExistent');
      expect(prompts).toEqual([]);
    });
  });

  describe('searchSuggestions', () => {
    it('should return matching suggestions for valid query', () => {
      const results = service.searchSuggestions('mountain');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.toLowerCase()).toContain('mountain');
      });
    });

    it('should return empty array for short query (less than 2 chars)', () => {
      const results = service.searchSuggestions('a');
      expect(results).toEqual([]);
    });

    it('should return empty array for empty query', () => {
      const results = service.searchSuggestions('');
      expect(results).toEqual([]);
    });

    it('should be case insensitive', () => {
      const results = service.searchSuggestions('MOUNTAIN');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should limit results to 5 max', () => {
      const results = service.searchSuggestions('with');
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });
});
