// enviroments.ts

export const environment = {
  production: true,
  // Para auth-service
  apiBaseUrl: '/api', 
  // Para teams-service (puerto 8082 en host)
  teamsApiUrl: 'http://localhost:8082/api/teams', 
  // Para players-service (puerto 3001 en host)
  playersApiUrl: 'http://localhost:3001/api/players' 
};