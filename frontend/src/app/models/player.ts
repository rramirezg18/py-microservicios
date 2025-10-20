/**
 * Representa un jugador registrado en el sistema.
 * Consumido desde el microservicio players-service (Laravel + MySQL)
 */
export interface Player {
  /** Identificador único del jugador */
  id: number;

  /** Número en camiseta */
  number: number;

  /** Nombre completo del jugador */
  name: string;

  /** ID del equipo al que pertenece */
  teamId: number;

  /** Nombre del equipo, opcional si se incluye en respuesta extendida */
  teamName?: string;
}
