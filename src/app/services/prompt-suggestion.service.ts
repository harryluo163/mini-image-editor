import { Injectable } from '@angular/core';
import { PromptSuggestion } from '../models/ai-generation.model';

@Injectable({
  providedIn: 'root'
})
export class PromptSuggestionService {
  private readonly suggestions: PromptSuggestion[] = [
    {
      category: 'Landscape',
      prompts: [
        'A serene mountain landscape at sunset with golden light',
        'Tropical beach with crystal clear water and palm trees',
        'Misty forest with sunbeams filtering through tall trees',
        'Snow-capped mountains reflected in a calm lake',
        'Rolling hills covered in wildflowers under blue sky'
      ]
    },
    {
      category: 'Abstract',
      prompts: [
        'Abstract geometric patterns with vibrant gradients',
        'Fluid art with metallic gold and deep blue swirls',
        'Minimalist composition with circles and lines',
        'Cosmic nebula with swirling colors and stars',
        'Digital fractal art with infinite patterns'
      ]
    },
    {
      category: 'Architecture',
      prompts: [
        'Modern minimalist building with clean white surfaces',
        'Futuristic cityscape with glass and steel towers',
        'Ancient temple ruins overgrown with vegetation',
        'Cozy cafe interior with warm lighting and plants',
        'Grand library with towering bookshelves'
      ]
    },
    {
      category: 'Portrait',
      prompts: [
        'Professional headshot with studio lighting',
        'Artistic portrait with dramatic shadows',
        'Character concept art fantasy warrior',
        'Vintage style portrait with soft focus',
        'Digital art portrait with neon accents'
      ]
    },
    {
      category: 'Style Transfer',
      prompts: [
        'Oil painting style with thick brushstrokes',
        'Watercolor effect with soft bleeding edges',
        'Pixel art retro game style',
        'Pencil sketch with fine hatching details',
        'Pop art style with bold colors and dots'
      ]
    }
  ];

  getAllSuggestions(): PromptSuggestion[] {
    return this.suggestions;
  }

  getCategories(): string[] {
    return this.suggestions.map(s => s.category);
  }

  getSuggestionsByCategory(category: string): string[] {
    const found = this.suggestions.find(s => s.category === category);
    return found ? found.prompts : [];
  }

  searchSuggestions(query: string): string[] {
    if (!query || query.length < 2) {
      return [];
    }
    const lowerQuery = query.toLowerCase();
    const results: string[] = [];

    for (const category of this.suggestions) {
      for (const prompt of category.prompts) {
        if (prompt.toLowerCase().includes(lowerQuery)) {
          results.push(prompt);
        }
      }
    }
    return results.slice(0, 5);
  }
}
