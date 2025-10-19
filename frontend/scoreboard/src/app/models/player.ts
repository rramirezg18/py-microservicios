export interface Player {
  id: number;
  number: number;
  name: string;
  teamId: number;
  teamName?: string; // opcional, si el backend devuelve el nombre del equipo
}
