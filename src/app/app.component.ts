import { Component, ViewChild, HostListener, ChangeDetectorRef, OnInit, OnDestroy, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ImageEditorComponent } from './components/image-editor/image-editor.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { PropertiesPanelComponent } from './components/properties-panel/properties-panel.component';
import { AiGenerationPanelComponent } from './components/ai-generation-panel/ai-generation-panel.component';
import { EditorTool } from './models/ai-generation.model';
import { I18nService } from './services/i18n.service';
import { AiStateService } from './services/ai-state.service';

const MOBILE_BREAKPOINT = 768;
/** Minimum horizontal swipe distance (px) to trigger panel close. */
const SWIPE_THRESHOLD = 80;

/**
 * Top-level orchestration. Owns the layout, holds the reference to the image
 * editor, and threads data between the editor / toolbar / properties panel /
 * AI panel. Components themselves stay unaware of each other.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ImageEditorComponent,
    ToolbarComponent,
    PropertiesPanelComponent,
    AiGenerationPanelComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild(ImageEditorComponent) imageEditor!: ImageEditorComponent;

  readonly i18n = inject(I18nService);
  private readonly aiState = inject(AiStateService);

  activeTool: EditorTool | null = null;
  showPropertiesPanel = false;
  showAiPanel = true;
  isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  /** Drives the canvas loading overlay. Mirrors AiStateService.generationState. */
  isGenerating = false;

  private destroy$ = new Subject<void>();

  /**
   * Bound function passed into the AI panel so it can pull the current canvas
   * image on-demand (for img2img / enhance). Kept as a bound getter rather
   * than a plain method so `this` stays wired when the panel invokes it.
   */
  readonly getCanvasImage = (): string => this.imageEditor?.exportImage() ?? '';

  constructor(private cdr: ChangeDetectorRef, private elRef: ElementRef) {}

  // ── Swipe gesture state (mobile: swipe right to close AI panel) ──
  private touchStartX = 0;
  private touchStartY = 0;
  private isSwiping = false;

  ngOnInit(): void {
    // Keep the canvas overlay in sync with the AI generation lifecycle.
    // We derive a boolean from `generationState$` rather than binding the
    // enum directly so image-editor doesn't need to know about AI state.
    this.aiState.generationState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        const next = state === 'loading';
        if (next !== this.isGenerating) {
          this.isGenerating = next;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** User clicked Cancel on the canvas overlay. */
  onCancelGeneration(): void {
    this.aiState.cancelGeneration();
  }

  @HostListener('window:resize')
  onResize(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    // Auto-close the mobile properties overlay when transitioning back to
    // desktop; otherwise it stays lingering behind the sidebar layout.
    if (wasMobile && !this.isMobile) {
      this.showPropertiesPanel = true; // desktop: show inline by default when a tool is active
    }
  }

  // ── Touch gesture handlers (swipe right to close right panel) ──────────────
  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent): void {
    if (!this.isMobile || !this.showAiPanel) return;
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isSwiping = false;
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(e: TouchEvent): void {
    if (!this.isMobile || !this.showAiPanel) return;
    const touch = e.touches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = Math.abs(touch.clientY - this.touchStartY);
    // Only consider horizontal swipes (dx > dy) moving rightward
    if (dx > 30 && dx > dy) {
      this.isSwiping = true;
    }
  }

  @HostListener('touchend')
  onTouchEnd(): void {
    if (this.isSwiping) {
      // Swipe right detected → close right panel
      this.showAiPanel = false;
      this.cdr.markForCheck();
    }
    this.isSwiping = false;
  }

  /** Backdrop tap on mobile → close all open panels */
  onBackdropClick(): void {
    this.showAiPanel = false;
    this.showPropertiesPanel = false;
  }

  onToolSelected(tool: EditorTool): void {
    this.activeTool = tool;
    this.showPropertiesPanel = true;
    this.imageEditor?.activateTool(tool);
  }

  onFilterApplied(filter: string): void {
    this.imageEditor?.applyFilter(filter);
  }

  onColorChanged(color: string): void {
    this.imageEditor?.setDrawingColor(color);
  }

  onWidthChanged(width: number): void {
    this.imageEditor?.setDrawingWidth(width);
  }

  onApplyCrop(): void {
    this.imageEditor?.applyCrop();
  }

  onCancelCrop(): void {
    this.imageEditor?.cancelCrop();
  }

  onRotate(degrees: number): void {
    // Positive = clockwise, negative = counter-clockwise.
    this.imageEditor?.rotate(degrees);
  }

  onShapeChanged(shape: 'rect' | 'circle' | 'triangle'): void {
    // Forward the picked shape to the editor; if the Shape tool is already
    // active, TUI will use it for the next drag on the canvas.
    this.imageEditor?.setShape(shape);
  }

  onUndo(): void { this.imageEditor?.undo(); }
  onRedo(): void { this.imageEditor?.redo(); }
  onClear(): void { this.imageEditor?.clearCanvas(); }

  onExport(): void {
    const dataUrl = this.imageEditor?.exportImage();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `creaition-export-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }

  onImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.imageEditor?.loadImageFromFile(file);
        this.cdr.detectChanges();
      }
    };
    input.click();
  }

  onAiImageSelected(imageData: string): void {
    this.imageEditor?.loadImage(imageData);
    this.cdr.detectChanges();
  }

  onCloseProperties(): void {
    this.showPropertiesPanel = false;
  }

  toggleAiPanel(): void {
    this.showAiPanel = !this.showAiPanel;
  }

  /** Whether the editor currently has a user-supplied image. */
  get canvasHasImage(): boolean {
    return this.imageEditor?.hasImage() ?? false;
  }
}
