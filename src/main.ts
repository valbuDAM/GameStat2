import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';
import { pageTransitionAnimation } from './app/shared/animations/page-transition';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideAnimations(),
    provideRouter(appRoutes, withComponentInputBinding()),
    // Ionic 8 standalone con animacion nativa personalizada.
    provideIonicAngular({
      mode: 'md',
      navAnimation: pageTransitionAnimation
    })
  ]
}).catch((error) => console.error(error));
