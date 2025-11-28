// Manejo de jugadores en el servidor
// Almacena y gestiona todos los jugadores conectados

import type { Player } from '../shared/types.js';

export class PlayerManager {
  private players: Map<string, Player> = new Map();

  /**
   * Agrega un nuevo jugador
   */
  addPlayer(player: Player): void {
    this.players.set(player.id, player);
  }

  /**
   * Remueve un jugador por ID
   */
  removePlayer(playerId: string): boolean {
    return this.players.delete(playerId);
  }

  /**
   * Obtiene un jugador por ID
   */
  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  /**
   * Obtiene todos los jugadores
   */
  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Obtiene todos los jugadores vivos
   */
  getAlivePlayers(): Player[] {
    return this.getAllPlayers().filter(p => p.alive);
  }

  /**
   * Verifica si existe un jugador
   */
  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  /**
   * Obtiene el número de jugadores
   */
  getPlayerCount(): number {
    return this.players.size;
  }

  /**
   * Limpia todos los jugadores
   */
  clear(): void {
    this.players.clear();
  }
}

