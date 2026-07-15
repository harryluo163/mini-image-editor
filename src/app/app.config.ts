import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

// Angular Material's overlay-driven components (MatSnackBar, MatDialog) are
// used directly in standalone components. All they need at app bootstrap is
// the animations provider — Material's own providers register lazily.
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideAnimations()
  ]
};
