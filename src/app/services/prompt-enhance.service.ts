import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/**
 * Talks to the same-origin `/api/enhance-prompt` serverless proxy which in
 * turn calls SenseNova's OpenAI-compatible chat completion endpoint to
 * expand a short user idea into a richer image-generation prompt.
 *
 * The SenseNova token lives only on the server as the SENSENOVA_TOKEN env
 * var — never in the SPA bundle.
 */
@Injectable({ providedIn: 'root' })
export class PromptEnhanceService {
  private readonly url = '/api/enhance-prompt';

  constructor(private http: HttpClient) {}

  enhance(prompt: string): Observable<string> {
    return this.http.post<{ prompt: string }>(this.url, { prompt }).pipe(
      map(res => res.prompt),
      catchError((err: HttpErrorResponse) => {
        // The API returns `{ error: string }` on failure. Fall back to the
        // HTTP status text so the UI still shows something intelligible when
        // the network path itself broke (e.g. 0/proxy failure).
        const message =
          (err.error && typeof err.error === 'object' && err.error.error) ||
          err.message ||
          `Prompt enhance failed (${err.status})`;
        return throwError(() => new Error(message));
      })
    );
  }
}
