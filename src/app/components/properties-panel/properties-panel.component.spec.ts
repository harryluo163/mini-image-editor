import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropertiesPanelComponent } from './properties-panel.component';

describe('PropertiesPanelComponent', () => {
  let component: PropertiesPanelComponent;
  let fixture: ComponentFixture<PropertiesPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertiesPanelComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PropertiesPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes a default palette and filter list', () => {
    expect(component.colors.length).toBeGreaterThan(0);
    expect(component.filters.length).toBeGreaterThan(0);
    expect(component.filters.map(f => f.id)).toContain('grayscale');
  });

  it('emits filterApplied when a filter is selected', () => {
    spyOn(component.filterApplied, 'emit');
    component.onFilterSelect('sepia');
    expect(component.filterApplied.emit).toHaveBeenCalledWith('sepia');
    expect(component.selectedFilter).toBe('sepia');
  });

  it('emits colorChanged when a swatch is picked', () => {
    spyOn(component.colorChanged, 'emit');
    component.onColorSelect('#ff0000');
    expect(component.colorChanged.emit).toHaveBeenCalledWith('#ff0000');
    expect(component.drawColor).toBe('#ff0000');
  });

  it('emits widthChanged via onWidthChange', () => {
    spyOn(component.widthChanged, 'emit');
    component.drawWidth = 8;
    component.onWidthChange();
    expect(component.widthChanged.emit).toHaveBeenCalledWith(8);
  });

  it('emits applyCrop', () => {
    spyOn(component.applyCrop, 'emit');
    component.onApplyCrop();
    expect(component.applyCrop.emit).toHaveBeenCalled();
  });

  it('emits cancelCrop', () => {
    spyOn(component.cancelCrop, 'emit');
    component.onCancelCrop();
    expect(component.cancelCrop.emit).toHaveBeenCalled();
  });

  it('emits rotate with signed degrees', () => {
    spyOn(component.rotate, 'emit');
    component.onRotate(-90);
    expect(component.rotate.emit).toHaveBeenCalledWith(-90);
  });

  it('emits closeMobile', () => {
    spyOn(component.closeMobile, 'emit');
    component.onClose();
    expect(component.closeMobile.emit).toHaveBeenCalled();
  });

  it('applies mobile-visible class when isMobileVisible is true', () => {
    component.isMobileVisible = true;
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.properties-panel');
    expect(el.classList).toContain('properties-panel--mobile-visible');
  });
});
