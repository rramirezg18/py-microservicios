// src/main.ts
console.log('Zone present?', (globalThis as any).Zone?.version);

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

console.log('>> Bootstrapping Angular app …');

bootstrapApplication(AppComponent, appConfig)
  .then(appRef => {
    console.log('>> Angular app bootstrapped successfully', appRef);
  })
  .catch(err => {
    console.error('>> Bootstrapping Angular app FAILED', err);
  });
