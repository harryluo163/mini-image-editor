import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorTool } from '../../models/ai-generation.model';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './properties-panel.component.html',
  styleUrls: ['./properties-panel.component.scss']
})
export class PropertiesPanelComponent {
  @Input() activeTool: EditorTool | null = null;
  /**
   * Controls the mobile bottom-sheet modal state. On desktop this is ignored
   * (the panel is rendered inline in the right sidebar). On <768px screens
   * the panel is fixed to the bottom and translates in/out based on this flag.
   */
  @Input() isMobileVisible = false;

  @Output() closeMobile = new EventEmitter<void>();
  @Output() filterApplied = new EventEmitter<string>();
  @Output() colorChanged = new EventEmitter<string>();
  @Output() widthChanged = new EventEmitter<number>();
  @Output() applyCrop = new EventEmitter<void>();
  @Output() cancelCrop = new EventEmitter<void>();
  @Output() rotate = new EventEmitter<number>();
  @Output() shapeChanged = new EventEmitter<'rect' | 'circle' | 'triangle'>();

  readonly i18n = inject(I18nService);

  drawColor = '#000000';
  drawWidth = 3;
  selectedFilter = '';
  selectedShape: 'rect' | 'circle' | 'triangle' = 'rect';

  get shapes() {
    return [
      { id: 'rect' as const,     label: this.i18n.t('props.rectangle'), icon: '■' },
      { id: 'circle' as const,   label: this.i18n.t('props.circle'),    icon: '●' },
      { id: 'triangle' as const, label: this.i18n.t('props.triangle'),  icon: '▲' }
    ];
  }

  get filters() {
    return [
      { id: 'grayscale', label: this.i18n.t('props.grayscale') },
      { id: 'sepia', label: this.i18n.t('props.sepia') },
      { id: 'invert', label: this.i18n.t('props.invert') },
      { id: 'blur', label: this.i18n.t('props.blur') },
      { id: 'sharpen', label: this.i18n.t('props.sharpen') }
    ];
  }

  readonly colors = [
    '#000000', '#ffffff', '#ff0000', '#00ff00',
    '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
    '#ff6600', '#663399'
  ];

  onFilterSelect(filterId: string): void {
    this.selectedFilter = filterId;
    this.filterApplied.emit(filterId);
  }

  onColorSelect(color: string): void {
    this.drawColor = color;
    this.colorChanged.emit(color);
  }

  onWidthChange(): void {
    this.widthChanged.emit(this.drawWidth);
  }

  onApplyCrop(): void {
    this.applyCrop.emit();
  }

  onCancelCrop(): void {
    this.cancelCrop.emit();
  }

  onRotate(degrees: number): void {
    this.rotate.emit(degrees);
  }

  onShapeSelect(shape: 'rect' | 'circle' | 'triangle'): void {
    this.selectedShape = shape;
    this.shapeChanged.emit(shape);
  }

  onClose(): void {
    this.closeMobile.emit();
  }
}
