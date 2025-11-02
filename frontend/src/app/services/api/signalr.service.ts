// src/app/services/api/signalr.service.ts
import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hubConnection?: signalR.HubConnection;

  // ✅ Ruta del Hub (sin querystring)
  private readonly baseUrl = '/hub/matches';

  // 🚀 Inicia la conexión con validación y headers
  startConnection(matchId: number, token?: string) {
    if (!matchId || matchId <= 0) {
      console.error('❌ matchId inválido en startConnection');
      return;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.baseUrl, {
        accessTokenFactory: () => token ?? '',
        transport: signalR.HttpTransportType.WebSockets,
        // 👇 se envía como header para no perderlo en el reconnect
        headers: { 'X-Match-Id': String(matchId) },
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection
      .start()
      .then(() => console.log(`✅ SignalR conectado al grupo match-${matchId}`))
      .catch(err => console.error('❌ Error al conectar SignalR:', err));
  }

  // 🔌 Detiene la conexión
  stopConnection() {
    if (this.hubConnection) {
      this.hubConnection.stop()
        .then(() => console.log('🔌 SignalR desconectado'))
        .catch(err => console.error('❌ Error al detener conexión:', err));
    }
  }

  // 📢 Evento marcador
  onScoreUpdated(callback: (data: any) => void) {
    this.hubConnection?.on('scoreUpdated', callback);
  }

  // 📢 Evento faltas
  onFoulsUpdated(callback: (data: any) => void) {
    this.hubConnection?.on('foulsUpdated', callback);
  }
}
