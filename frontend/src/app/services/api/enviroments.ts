// src/app/services/api/enviromments.ts
export const environment = {
  production: true,

  // Siempre a través de Nginx (mismo origen):
  apiBaseUrl: '/api',

  // Endpoints específicos
  teamsApiUrl: '/api/teams',
  playersApiUrl: '/api/players',
  apiMatches: '/api/matches', // 👈 AGREGA ESTA LÍNEA

  // Donde aterriza el callback de OAuth en tu SPA
  oauthRedirect: '/oauth/callback',
};
