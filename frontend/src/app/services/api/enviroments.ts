// src/app/services/api/environments.ts
export const environment = {
  production: true,

  // Siempre a través de Nginx (mismo origen):
  apiBaseUrl: '/api',

  // Rutas convenientes por si en otros servicios las usas desde environment:
  teamsApiUrl: '/api/teams',
  playersApiUrl: '/api/players',

  // Donde aterriza el callback de OAuth en tu SPA
  oauthRedirect: '/oauth/callback',
};
