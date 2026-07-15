import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Observable, throwError, from, of } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AiGenerationRequest, ModelConfig } from '../models/ai-generation.model';

/**
 * Two-phase proxy client for ModelScope image generation:
 *   1. `POST /api/generate` returns a `task_id` immediately.
 *   2. The browser polls `GET /api/task?id=<task_id>` every few seconds
 *      until the same endpoint responds with image bytes (200 image/png) or
 *      an error.
 *
 * Splitting the wait onto the client side sidesteps Vercel's 60s hard cap
 * on serverless function duration, which used to surface as opaque
 * `[object Object]` FUNCTION_INVOCATION_TIMEOUT errors when Qwen-Image-Edit
 * took ~40-90s to finish.
 *
 * MODELSCOPE_TOKEN stays on the server; the client never sees it.
 */
@Injectable({
  providedIn: 'root'
})
export class AiImageService {
  private readonly proxyUrl = environment.apiProxyUrl;
  private readonly taskUrl = '/api/task';

  /** Delay between polls once a task has been created. */
  private readonly pollIntervalMs = 2500;
  /** Hard cap on the poll loop so a stuck task can't loop forever. */
  private readonly maxPollAttempts = 60; // 60 * 2.5s = 150s

  constructor(private http: HttpClient) {}

  generateImage(request: AiGenerationRequest, model: ModelConfig): Observable<string> {
    const body: Record<string, unknown> = {
      model: model.endpoint,
      prompt: request.prompt
    };
    // Img2img: attach the current canvas image (data URL) so the backend can
    // forward it as `image_url` to ModelScope. Edit models such as
    // Qwen-Image-Edit hard-require this.
    if (request.sourceImage) {
      body['image'] = request.sourceImage;
    }
    return this.startAndPoll(body);
  }

  editImage(sourceImage: string, request: AiGenerationRequest, model: ModelConfig): Observable<string> {
    return this.startAndPoll({
      model: model.endpoint,
      prompt: request.prompt,
      image: sourceImage
    });
  }

  enhanceImage(imageData: string, model: ModelConfig): Observable<string> {
    const enhancePrompt = 'Enhance this image: ultra-detailed, high resolution, sharp focus, professional quality';
    return this.editImage(imageData, { prompt: enhancePrompt }, model);
  }

  batchGenerate(requests: AiGenerationRequest[], model: ModelConfig): Observable<string>[] {
    return requests.map(req => this.generateImage(req, model));
  }

  /**
   * Create a task then wire the caller up to the polling loop. Callers get
   * a single-emit Observable that either yields the final image data URL or
   * errors out. Unsubscribing at any point stops the loop (see `pollTask`);
   * ModelScope keeps running the task server-side but we stop waiting.
   */
  private startAndPoll(body: Record<string, unknown>): Observable<string> {
    return this.http.post<{ task_id: string }>(this.proxyUrl, body).pipe(
      mergeMap(res => {
        if (!res || typeof res.task_id !== 'string' || !res.task_id) {
          return throwError(() => new Error('Server did not return a task_id.'));
        }
        return this.pollTask(res.task_id);
      }),
      catchError((err: HttpErrorResponse | Error) => this.handleError(err))
    );
  }

  /**
   * Poll `/api/task?id=...` until the endpoint responds with an image
   * (Content-Type starts with `image/`) or errors out. Every emission that
   * comes back as JSON `{ status: "pending" | "running" }` is treated as a
   * "keep going" signal.
   *
   * Implemented as a hand-rolled Observable rather than an operator pipe
   * because we need three things at once: (1) a stateful attempt counter,
   * (2) a stop signal driven by unsubscribe (Cancel button), (3) chained
   * async work per tick (HTTP + Blob decode). The teardown function is what
   * makes Cancel work.
   */
  private pollTask(taskId: string): Observable<string> {
    return new Observable<string>(observer => {
      let attempts = 0;
      let cancelled = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let innerSub: { unsubscribe(): void } | null = null;

      const scheduleNext = () => {
        if (cancelled) return;
        timeoutHandle = setTimeout(runOnce, this.pollIntervalMs);
      };

      const runOnce = () => {
        if (cancelled) return;
        attempts++;
        if (attempts > this.maxPollAttempts) {
          const seconds = Math.round(this.maxPollAttempts * this.pollIntervalMs / 1000);
          observer.error(new Error(`Generation timed out after ${seconds}s. Please try again.`));
          return;
        }

        innerSub = this.checkTask(taskId).subscribe({
          next: result => {
            if (cancelled) return;
            if (result.done) {
              observer.next(result.dataUrl);
              observer.complete();
            } else {
              scheduleNext();
            }
          },
          error: err => {
            if (cancelled) return;
            observer.error(err);
          }
        });
      };

      // First poll after a short delay so the task has a moment to spin up.
      scheduleNext();

      return () => {
        cancelled = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (innerSub) innerSub.unsubscribe();
      };
    });
  }

  /**
   * One poll tick. Resolves to either a done-with-image result or a
   * still-running signal. Errors (4xx/5xx JSON from api/task) bubble up.
   */
  private checkTask(taskId: string): Observable<{ done: true; dataUrl: string } | { done: false; status: string }> {
    return this.http.get(this.taskUrl, {
      params: { id: taskId },
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      mergeMap((resp: HttpResponse<Blob>) => {
        const contentType = resp.headers.get('Content-Type') || '';
        const body = resp.body as Blob;
        if (contentType.startsWith('image/')) {
          return this.blobToBase64(body).pipe(
            mergeMap(dataUrl => of<{ done: true; dataUrl: string }>({ done: true, dataUrl }))
          );
        }
        // JSON status. Blob->text so we can peek at { status: "..." }.
        return from(body.text()).pipe(
          mergeMap(txt => {
            let status = 'pending';
            try {
              const parsed = JSON.parse(txt);
              if (parsed && typeof parsed.status === 'string') status = parsed.status;
            } catch { /* keep "pending" fallback */ }
            return of<{ done: false; status: string }>({ done: false, status });
          })
        );
      })
    );
  }

  private blobToBase64(blob: Blob): Observable<string> {
    return new Observable(observer => {
      const reader = new FileReader();
      reader.onload = () => {
        observer.next(reader.result as string);
        observer.complete();
      };
      reader.onerror = (error) => observer.error(error);
      reader.readAsDataURL(blob);
    });
  }

  private handleError(error: HttpErrorResponse | Error): Observable<never> {
    // Non-HTTP errors (e.g. thrown Error from timeout) — surface as-is.
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() => (error instanceof Error ? error : new Error(String(error))));
    }

    const statusPart = this.statusMessage(error.status);

    // The task poll uses `responseType: 'blob'` so JSON error bodies arrive
    // as Blobs; decode them asynchronously and merge in the server's
    // `error` field for a diagnosable message.
    const body$: Observable<string> = error.error instanceof Blob
      ? from(error.error.text()).pipe(
          mergeMap(txt => of(this.extractServerMessage(txt))),
          catchError(() => of(''))
        )
      : of(this.errorFrom(error.error));

    return body$.pipe(
      mergeMap(bodyMsg => {
        const full = bodyMsg ? `${statusPart}: ${bodyMsg}` : statusPart;
        return throwError(() => new Error(full));
      })
    );
  }

  private statusMessage(status: number): string {
    if (status === 0) return 'Network error. Please check your connection.';
    if (status === 401) return 'Invalid MODELSCOPE_TOKEN';
    if (status === 429) return 'Rate limit exceeded';
    if (status === 503) return 'Model is loading, please retry in ~20s';
    if (status === 504) return 'Generation timed out';
    if (status >= 400) return `API error (${status})`;
    return `Unexpected status ${status}`;
  }

  private extractServerMessage(txt: string): string {
    try {
      return this.errorFrom(JSON.parse(txt));
    } catch {
      return txt ? txt.slice(0, 300) : '';
    }
  }

  /**
   * Extract a human-readable string out of either our own `{ error: "..." }`
   * shape or the Vercel platform's `{ error: { code, message } }` object.
   */
  private errorFrom(payload: unknown): string {
    if (payload == null) return '';
    if (typeof payload === 'string') return payload;
    if (typeof payload !== 'object') return '';

    const obj = payload as Record<string, unknown>;
    const err = obj['error'];

    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const inner = err as Record<string, unknown>;
      if (typeof inner['message'] === 'string') return inner['message'] as string;
      if (typeof inner['code'] === 'string') return inner['code'] as string;
      try { return JSON.stringify(err).slice(0, 300); } catch { /* ignore */ }
    }

    if (typeof obj['message'] === 'string') return obj['message'] as string;
    return '';
  }
}
