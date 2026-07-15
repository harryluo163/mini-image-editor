import {
  Component,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  Input,
  Output,
  EventEmitter,
  HostListener,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorTool } from '../../models/ai-generation.model';
import { I18nService } from '../../services/i18n.service';

declare const tui: any;

/**
 * Thin Angular wrapper around Toast UI Image Editor (loaded via CDN in
 * index.html — see README for rationale). Public methods expose the subset
 * of the underlying API the rest of the app needs, so consumers never touch
 * `tui` directly.
 */
@Component({
  selector: 'app-image-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-editor.component.html',
  styleUrls: ['./image-editor.component.scss']
})
export class ImageEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;
  @Output() editorReady = new EventEmitter<void>();

  readonly i18n = inject(I18nService);

  /**
   * When true, a translucent overlay covers the canvas showing a spinner
   * and a Cancel button. Driven by the top-level `AiStateService` via the
   * parent `AppComponent` — the editor itself stays unaware of AI state.
   */
  @Input() isGenerating = false;
  /** Fired when the user clicks Cancel on the loading overlay. */
  @Output() cancelGeneration = new EventEmitter<void>();

  private editorInstance: any = null;
  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  /**
   * True once the initial `loadImageFromURL` Promise has resolved. TUI keeps
   * an internal command queue that throws "command state is locked" if you
   * call `resizeCanvasDimension` (or most other APIs) while the queue is
   * still draining, so anything driven by DOM events must gate on this flag.
   */
  private isEditorReady = false;
  /** Whether a user-supplied image (not the blank canvas) is currently loaded. */
  private hasUserImage = false;
  /**
   * Current shape settings. Persisted between tool activations so switching
   * away and back to Shape doesn't reset the user's choice.
   */
  private shapeState = {
    type: 'rect' as 'rect' | 'circle' | 'triangle',
    fill: '#000000',
    stroke: '#000000',
    strokeWidth: 3
  };

  /**
   * Current text settings. TUI's TEXT drawing mode in headless (no UI) mode
   * only fires an `addText` event on canvas click — it does NOT insert any
   * text on its own. We listen for that event (see `initEditor`) and place
   * a placeholder here using these styles; fabric.js's built-in double-click
   * editing on IText takes over from there.
   */
  private textState = {
    fill: '#000000',
    fontSize: 40,
    fontFamily: 'Recursive, sans-serif'
  };

  ngAfterViewInit(): void {
    this.initEditor();
  }

  ngOnDestroy(): void {
    if (this.editorInstance) this.editorInstance.destroy();
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    // Debounce so we don't thrash TUI during window drag.
    this.resizeTimeout = setTimeout(() => this.resizeCanvas(), 250);
  }

  // -----------------------------------------------------------------------
  // Public API — called by parent orchestrator
  // -----------------------------------------------------------------------

  activateTool(tool: EditorTool): void {
    if (!this.editorInstance) return;

    switch (tool) {
      case 'crop':
        this.editorInstance.startDrawingMode('CROPPER');
        break;
      case 'rotate':
        // Rotate is a one-shot action; the tool "activation" applies it once.
        this.editorInstance.rotate(90);
        break;
      case 'draw':
        this.editorInstance.startDrawingMode('FREE_DRAWING', { width: 3, color: '#000000' });
        break;
      case 'text':
        // Headless TUI only ARMS text mode here — the actual placement
        // happens in the `addText` event handler wired up in `initEditor`.
        this.editorInstance.startDrawingMode('TEXT');
        break;
      case 'shape':
        // TUI's SHAPE mode needs an explicit shape type + style options, or
        // it silently defaults to a stroke-only rectangle (the "square outline"
        // bug users hit). Prime it with the current shapeState so the very
        // first drag on the canvas produces a visible, filled shape.
        this.editorInstance.startDrawingMode('SHAPE');
        this.applyShapeSettings();
        break;
      case 'filter':
        // Filters are applied on-demand via applyFilter().
        this.editorInstance.stopDrawingMode();
        break;
    }
  }

  /**
   * Commit the current crop selection. Returns a resolved promise when TUI
   * has finished re-rendering so callers can chain further edits.
   */
  applyCrop(): Promise<void> {
    if (!this.editorInstance) return Promise.resolve();
    const rect = this.editorInstance.getCropzoneRect();
    if (!rect) {
      // No selection yet — leave the cropper mode active so the user can drag.
      return Promise.resolve();
    }
    return this.editorInstance.crop(rect).then(() => {
      this.editorInstance.stopDrawingMode();
    });
  }

  cancelCrop(): void {
    if (this.editorInstance) this.editorInstance.stopDrawingMode();
  }

  applyFilter(filterName: string): void {
    if (!this.editorInstance) return;
    switch (filterName) {
      case 'grayscale': this.editorInstance.applyFilter('Grayscale'); break;
      case 'invert':    this.editorInstance.applyFilter('Invert'); break;
      case 'blur':      this.editorInstance.applyFilter('Blur', { blur: 0.1 }); break;
      case 'sharpen':   this.editorInstance.applyFilter('Sharpen'); break;
      case 'sepia':     this.editorInstance.applyFilter('Sepia'); break;
    }
  }

  setDrawingColor(color: string): void {
    if (this.editorInstance) this.editorInstance.setBrush({ color });
    // Keep shape state in sync so the user's chosen colour applies to shapes too.
    this.shapeState.fill = color;
    this.shapeState.stroke = color;
    this.applyShapeSettings();
    // Text uses the same swatch — new placeholders will pick up the colour.
    this.textState.fill = color;
  }

  setDrawingWidth(width: number): void {
    if (this.editorInstance) this.editorInstance.setBrush({ width });
    this.shapeState.strokeWidth = width;
    this.applyShapeSettings();
  }

  /**
   * Set the active shape type (rect / circle / triangle). Call while the
   * Shape tool is active; TUI updates its internal drawing mode so the next
   * drag on the canvas draws the chosen shape.
   */
  setShape(type: 'rect' | 'circle' | 'triangle'): void {
    this.shapeState.type = type;
    this.applyShapeSettings();
  }

  private applyShapeSettings(): void {
    if (!this.editorInstance) return;
    this.editorInstance.setDrawingShape(this.shapeState.type, {
      fill: this.shapeState.fill,
      stroke: this.shapeState.stroke,
      strokeWidth: this.shapeState.strokeWidth
    });
  }

  loadImage(imageData: string): void {
    if (!this.editorInstance) {
      console.warn('[image-editor] loadImage called before TUI init');
      return;
    }
    // TUI's internal command queue can still be draining a previous op
    // (loadImageFromURL of the blank canvas, a filter apply, ...); calling
    // loadImageFromURL synchronously in that window rejects with
    // "The executing command state is locked". Deferring by one frame lets
    // the queue drain, and .catch() makes silent failures visible in the
    // console instead of the image just "not showing up".
    const dataPreview = imageData.slice(0, 60) + '…';
    console.log('[image-editor] loadImage received', dataPreview);
    requestAnimationFrame(() => {
      if (!this.editorInstance) return;
      this.editorInstance.loadImageFromURL(imageData, 'AI Generated')
        .then(() => {
          console.log('[image-editor] loadImageFromURL resolved');
          this.hasUserImage = true;
          this.resizeCanvas();
        })
        .catch((err: unknown) => {
          console.error('[image-editor] loadImageFromURL rejected:', err);
        });
    });
  }

  loadImageFromFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => this.loadImage(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  /** Returns a PNG data URL of the current canvas, or empty string. */
  exportImage(): string {
    return this.editorInstance?.toDataURL() ?? '';
  }

  /**
   * True when the user has loaded/generated an image. The blank canvas the
   * editor bootstraps with does not count — this lets the AI panel disable
   * "Use canvas as source" until there's something meaningful to send.
   */
  hasImage(): boolean {
    return this.hasUserImage;
  }

  undo(): void { this.editorInstance?.undo(); }
  redo(): void { this.editorInstance?.redo(); }
  clearCanvas(): void { this.editorInstance?.clearObjects(); }
  stopDrawing(): void { this.editorInstance?.stopDrawingMode(); }

  /**
   * Rotate the current image by an arbitrary signed angle.
   * Positive = clockwise, negative = counter-clockwise. Exposed so the
   * properties panel can offer both directions without callers reaching
   * into the TUI instance.
   */
  rotate(degrees: number): void {
    this.editorInstance?.rotate(degrees);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  private initEditor(): void {
    const container = this.editorContainer.nativeElement;

    // TUI has two construction modes:
    //   - "headless" / no UI: `new tui.ImageEditor(el, { cssMaxWidth, ... })`
    //   - with UI:            same + `includeUI: {...}`
    //
    // We use headless because the app supplies its own toolbar / properties
    // panel (`toolbar.component`, `properties-panel.component`). Mixing
    // `includeUI` with `initMenu: ''` is a footgun — TUI still wires the UI
    // layer's event listeners (`objectActivated`, `addObjectAfter`, ...), but
    // the sub-menus they call into (`shapeSubMenu.changeSelectableAll`,
    // `textSubMenu.stopDrawingMode`, ...) are never instantiated, so the
    // first shape / text interaction throws
    // "Cannot read properties of undefined (reading '...')".
    this.editorInstance = new tui.ImageEditor(container, {
      cssMaxWidth: container.offsetWidth,
      cssMaxHeight: container.offsetHeight,
      usageStatistics: false
    });

    // TUI's TEXT mode in headless setups only *emits* `addText` on canvas
    // click; it never draws anything itself. Without this listener the
    // Text tool silently does nothing ("text 不管用"). We insert a visible
    // placeholder at the click location using the current textState; users
    // then double-click it to enter fabric.js's inline IText editor.
    this.editorInstance.on('addText', (pos: { originPosition: { x: number; y: number } }) => {
      const placeholder = this.i18n.currentLang === 'zh' ? '双击编辑' : 'Double-click to edit';
      this.editorInstance
        .addText(placeholder, {
          position: pos.originPosition,
          styles: {
            fill: this.textState.fill,
            fontSize: this.textState.fontSize,
            fontWeight: 'normal',
            fontFamily: this.textState.fontFamily
          }
        })
        .catch(() => {
          // TUI's command queue is transiently locked (mid-load, mid-resize).
          // Swallow and let the user click again — same pattern as resizeCanvas.
        });
    });

    this.editorInstance
      .loadImageFromURL(this.createBlankCanvas(800, 600), 'New Image')
      .then(() => {
        this.isEditorReady = true;
        this.editorReady.emit();
      });
  }

  private createBlankCanvas(width: number, height: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL();
  }

  private resizeCanvas(): void {
    // Guard against three race conditions that all surface as the same TUI
    // error ("command state is locked" -> removeChild on a detached node):
    //   1. resize fires before the initial loadImageFromURL Promise resolves
    //   2. container has zero dimensions (hidden panel, mobile keyboard, ...)
    //   3. a previous TUI command is still mid-flight when the next one lands
    if (!this.isEditorReady || !this.editorInstance || !this.editorContainer) return;
    const el = this.editorContainer.nativeElement;
    if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return;
    try {
      this.editorInstance.resizeCanvasDimension({
        width: el.offsetWidth,
        height: el.offsetHeight
      });
    } catch {
      // TUI's queue is transiently locked — the next resize event (or the
      // debounced re-run) will apply the correct dimensions.
    }
  }
}
