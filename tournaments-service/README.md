# Tournaments Service

Microservicio Express que expone la información de los torneos y calcula el bracket en tiempo real para el frontend del scoreboard.

## Scripts

- `npm install` – instala dependencias.
- `npm run dev` – inicia el servicio con recarga en caliente (requiere nodemon).
- `npm start` – inicia el servicio en modo producción.

## Endpoints

- `GET /api/ping` – verificación de estado.
- `GET /api/tournaments` – lista de torneos con información resumida.
- `GET /api/tournaments/:id` – detalle completo del torneo con brackets, grupos y final.
- `PUT /api/tournaments/:id/matches/:matchId` – actualiza el marcador de un partido; el servicio propaga automáticamente el ganador a la siguiente ronda.

El servicio utiliza el puerto `8083` por defecto y puede configurarse con la variable de entorno `PORT`.
