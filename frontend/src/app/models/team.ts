/**
 * Representa un equipo dentro de un torneo.
 * Consumido desde el microservicio teams-service (Spring Boot + PostgreSQL)
 */
export interface Team {
  /** Identificador único del equipo */
  id: number;

  /** Nombre del equipo */
  name: string;

  /** Color representativo (hexadecimal) */
  color?: string;

  /** Cantidad total de jugadores asociados */
  playersCount?: number;
}
