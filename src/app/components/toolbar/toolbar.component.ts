import { Component, Output, EventEmitter, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorTool, ToolConfig } from '../../models/ai-generation.model';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {
  @Input() activeTool: EditorTool | null = null;
  @Output() toolSelected = new EventEmitter<EditorTool>();
  @Output() undoClicked = new EventEmitter<void>();
  @Output() redoClicked = new EventEmitter<void>();
  @Output() clearClicked = new EventEmitter<void>();
  @Output() exportClicked = new EventEmitter<void>();
  @Output() importClicked = new EventEmitter<void>();

  readonly i18n = inject(I18nService);

  isMobileMenuOpen = false;

  get tools(): ToolConfig[] {
    return [
      { id: 'crop', label: this.i18n.t('toolbar.crop'), icon: '✂️' },
      { id: 'rotate', label: this.i18n.t('toolbar.rotate'), icon: '🔄' },
      { id: 'draw', label: this.i18n.t('toolbar.draw'), icon: '✏️' },
      { id: 'text', label: this.i18n.t('toolbar.text'), icon: '𝐓' },
      { id: 'shape', label: this.i18n.t('toolbar.shape'), icon: '⬟' },
      { id: 'filter', label: this.i18n.t('toolbar.filter'), icon: '🎨' }
    ];
  }

  selectTool(tool: EditorTool): void {
    this.toolSelected.emit(tool);
    this.isMobileMenuOpen = false;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  onUndo(): void {
    this.undoClicked.emit();
  }

  onRedo(): void {
    this.redoClicked.emit();
  }

  onClear(): void {
    this.clearClicked.emit();
  }

  onExport(): void {
    this.exportClicked.emit();
  }

  onImport(): void {
    this.importClicked.emit();
  }
}
