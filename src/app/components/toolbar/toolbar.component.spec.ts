import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToolbarComponent } from './toolbar.component';
import { By } from '@angular/platform-browser';

describe('ToolbarComponent', () => {
  let component: ToolbarComponent;
  let fixture: ComponentFixture<ToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolbarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 6 editing tools', () => {
    expect(component.tools.length).toBe(6);
    expect(component.tools.map(t => t.id)).toEqual([
      'crop', 'rotate', 'draw', 'text', 'shape', 'filter'
    ]);
  });

  it('should emit toolSelected event when tool is clicked', () => {
    spyOn(component.toolSelected, 'emit');
    component.selectTool('draw');
    expect(component.toolSelected.emit).toHaveBeenCalledWith('draw');
  });

  it('should emit undoClicked event', () => {
    spyOn(component.undoClicked, 'emit');
    component.onUndo();
    expect(component.undoClicked.emit).toHaveBeenCalled();
  });

  it('should emit redoClicked event', () => {
    spyOn(component.redoClicked, 'emit');
    component.onRedo();
    expect(component.redoClicked.emit).toHaveBeenCalled();
  });

  it('should emit clearClicked event', () => {
    spyOn(component.clearClicked, 'emit');
    component.onClear();
    expect(component.clearClicked.emit).toHaveBeenCalled();
  });

  it('should emit exportClicked event', () => {
    spyOn(component.exportClicked, 'emit');
    component.onExport();
    expect(component.exportClicked.emit).toHaveBeenCalled();
  });

  it('should emit importClicked event', () => {
    spyOn(component.importClicked, 'emit');
    component.onImport();
    expect(component.importClicked.emit).toHaveBeenCalled();
  });

  it('should toggle mobile menu', () => {
    expect(component.isMobileMenuOpen).toBeFalse();
    component.toggleMobileMenu();
    expect(component.isMobileMenuOpen).toBeTrue();
    component.toggleMobileMenu();
    expect(component.isMobileMenuOpen).toBeFalse();
  });

  it('should close mobile menu when tool is selected', () => {
    component.isMobileMenuOpen = true;
    component.selectTool('crop');
    expect(component.isMobileMenuOpen).toBeFalse();
  });

  it('should render tool buttons in template', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.toolbar__buttons button'));
    // 6 tools + 3 actions (undo, redo, clear) + 2 file (import, export) = 11
    expect(buttons.length).toBe(11);
  });

  it('should highlight active tool', () => {
    component.activeTool = 'draw';
    fixture.detectChanges();

    const toolButtons = fixture.debugElement.queryAll(By.css('.toolbar__section:first-child .toolbar__buttons button'));
    const drawBtn = toolButtons[2]; // draw is 3rd tool
    expect(drawBtn.nativeElement.classList).toContain('creaition-btn--primary');
  });
});
