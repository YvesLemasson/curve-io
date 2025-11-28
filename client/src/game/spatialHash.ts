// FASE 2: Spatial Hash para optimización de colisiones (cliente)
// Misma lógica que el servidor pero para modo local

import type { Position } from '@shared/types';

export class SpatialHash {
  private cellSize: number;
  private width: number;
  private height: number;
  private grid: Map<string, Set<string>>; // cellKey -> Set<playerId>

  constructor(cellSize: number = 100, width: number = 1920, height: number = 1280) {
    this.cellSize = cellSize;
    this.width = width;
    this.height = height;
    this.grid = new Map();
  }

  /**
   * Obtiene la clave de celda para una posición
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Obtiene las celdas que intersecta un segmento de línea
   */
  private getCellsForLine(start: Position, end: Position): Set<string> {
    const cells = new Set<string>();
    
    // Agregar celdas de inicio y fin
    cells.add(this.getCellKey(start.x, start.y));
    cells.add(this.getCellKey(end.x, end.y));
    
    // Agregar celdas intermedias (Bresenham-like)
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const steps = Math.max(dx, dy) / this.cellSize;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      cells.add(this.getCellKey(x, y));
    }
    
    return cells;
  }

  /**
   * Obtiene las celdas adyacentes a una posición (incluyendo la celda misma)
   */
  private getNearbyCells(x: number, y: number): Set<string> {
    const cells = new Set<string>();
    const centerCellX = Math.floor(x / this.cellSize);
    const centerCellY = Math.floor(y / this.cellSize);
    
    // Verificar celdas en un radio de 1 (3x3 grid)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cellKey = `${centerCellX + dx},${centerCellY + dy}`;
        cells.add(cellKey);
      }
    }
    
    return cells;
  }

  /**
   * Limpia el grid
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Agrega un trail de jugador al grid
   */
  addTrail(playerId: string, trail: Array<Position | null>): void {
    // Remover entradas anteriores de este jugador
    this.removePlayer(playerId);
    
    // Agregar cada segmento del trail a las celdas correspondientes
    for (let i = 0; i < trail.length - 1; i++) {
      const start = trail[i];
      const end = trail[i + 1];
      
      if (!start || !end) continue; // Saltar breaks
      
      const cells = this.getCellsForLine(start, end);
      
      for (const cellKey of cells) {
        if (!this.grid.has(cellKey)) {
          this.grid.set(cellKey, new Set());
        }
        this.grid.get(cellKey)!.add(playerId);
      }
    }
  }

  /**
   * Remueve un jugador del grid
   */
  removePlayer(playerId: string): void {
    for (const [cellKey, players] of this.grid.entries()) {
      players.delete(playerId);
      if (players.size === 0) {
        this.grid.delete(cellKey);
      }
    }
  }

  /**
   * Obtiene los jugadores cuyos trails están en celdas cercanas a una posición
   */
  getNearbyPlayers(x: number, y: number): Set<string> {
    const nearbyCells = this.getNearbyCells(x, y);
    const players = new Set<string>();
    
    for (const cellKey of nearbyCells) {
      const cellPlayers = this.grid.get(cellKey);
      if (cellPlayers) {
        for (const playerId of cellPlayers) {
          players.add(playerId);
        }
      }
    }
    
    return players;
  }

  /**
   * Obtiene los jugadores cuyos trails intersectan con un segmento de línea
   */
  getPlayersForLine(start: Position, end: Position): Set<string> {
    const cells = this.getCellsForLine(start, end);
    const players = new Set<string>();
    
    for (const cellKey of cells) {
      const cellPlayers = this.grid.get(cellKey);
      if (cellPlayers) {
        for (const playerId of cellPlayers) {
          players.add(playerId);
        }
      }
    }
    
    return players;
  }
}

