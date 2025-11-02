// src/main.ts

console.log('Zone present?', (globalThis as any).Zone?.version);

import * as signalR from '@microsoft/signalr';

// 🧩 Fix global para SignalR (evita conexiones duplicadas sin matchId)
const hubPrototype = (signalR as any).HubConnection?.prototype;

if (hubPrototype && !(globalThis as any)._patchedSignalRStart) {
  const originalStart = hubPrototype.start;

  hubPrototype.start = function (..._args: any[]) {
    try {
      const url =
        (this as any).connection?.baseUrl ??
        (this as any).baseUrl ??
        '';

      if (url.includes('/hub/matches') && !url.includes('matchId=')) {
        console.warn('🟡 Ignorando conexión SignalR sin matchId (inicio prematuro)');
        return Promise.resolve();
      }
    } catch (err) {
      console.warn('🟡 Error verificando URL de SignalR', err);
    }

    return originalStart.call(this);
  };

  // ✅ Guardamos la marca global sin modificar el import
  (globalThis as any)._patchedSignalRStart = true;
}

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
