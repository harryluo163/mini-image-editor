import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageEditorComponent } from './image-editor.component';

/**
 * ImageEditorComponent wraps the CDN-loaded `tui.ImageEditor` global. In unit
 * tests that global is unavailable, so we only assert on the parts of the
 * public API that don't reach into the underlying editor.
 */
describe('ImageEditorComponent', () => {
  let component: ImageEditorComponent;
  let fixture: ComponentFixture<ImageEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageEditorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageEditorComponent);
    component = fixture.componentInstance;
    // Deliberately do NOT call fixture.detectChanges(); running ngAfterViewInit
    // would blow up because `tui` is undefined in a bare Karma environment.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reports no user image before init', () => {
    expect(component.hasImage()).toBeFalse();
  });

  it('exportImage returns empty string when the editor is uninitialised', () => {
    expect(component.exportImage()).toBe('');
  });

  it('silently no-ops when tools are activated pre-init', () => {
    // These would otherwise throw if they tried to touch a null instance.
    expect(() => component.activateTool('crop')).not.toThrow();
    expect(() => component.applyFilter('grayscale')).not.toThrow();
    expect(() => component.setDrawingColor('#000')).not.toThrow();
    expect(() => component.setDrawingWidth(3)).not.toThrow();
    expect(() => component.rotate(90)).not.toThrow();
    expect(() => component.undo()).not.toThrow();
    expect(() => component.redo()).not.toThrow();
  });
});
