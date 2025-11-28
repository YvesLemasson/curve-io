// Sistema de detección de colisiones en el servidor
// Misma lógica que el cliente pero para autoridad del servidor

import type { Position } from '../shared/types.js';

/**
 * Verifica si un punto está dentro de los límites del canvas
 */
export function checkBoundaryCollision(
  position: Position,
  width: number,
  height: number
): boolean {
  return (
    position.x < 0 ||
    position.x >= width ||
    position.y < 0 ||
    position.y >= height
  );
}

/**
 * Verifica si dos segmentos de línea se intersectan
 */
export function checkLineLineCollision(
  line1Start: Position,
  line1End: Position,
  line2Start: Position,
  line2End: Position
): boolean {
  const x1 = line1Start.x;
  const y1 = line1Start.y;
  const x2 = line1End.x;
  const y2 = line1End.y;
  const x3 = line2Start.x;
  const y3 = line2Start.y;
  const x4 = line2End.x;
  const y4 = line2End.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // Líneas paralelas
  if (Math.abs(denom) < 0.0001) {
    return false;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Verificar si la intersección está dentro de ambos segmentos
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * Verifica si la nueva posición del jugador colisiona con algún trail
 * FASE 1: Early exit - verificar trails cercanos primero y saltar los muy lejanos
 * IMPORTANTE: Salta segmentos con nulls (gaps) para permitir pasar a través de ellos
 */
export function checkTrailCollision(
  currentPos: Position,
  newPos: Position,
  trails: Array<{ trail: Array<Position | null>; playerId: string }>,
  excludePlayerId?: string
): { collided: boolean; collidedWith?: string } {
  // FASE 1: Calcular distancia máxima para considerar un trail (early exit)
  const MAX_DISTANCE_THRESHOLD = 200; // Píxeles - solo verificar trails dentro de este radio
  
  // Calcular posición media del nuevo segmento
  const midX = (currentPos.x + newPos.x) / 2;
  const midY = (currentPos.y + newPos.y) / 2;
  
  // Ordenar trails por distancia (más cercanos primero) para early exit
  const trailsWithDistance = trails
    .filter(({ playerId }) => !excludePlayerId || playerId !== excludePlayerId)
    .map(({ trail, playerId }) => {
      // Calcular distancia mínima del trail al segmento del jugador
      let minDistance = Infinity;
      
      for (const point of trail) {
        if (!point) continue; // Saltar nulls (gaps)
        const dx = point.x - midX;
        const dy = point.y - midY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
          minDistance = distance;
        }
      }
      
      return { trail, playerId, minDistance };
    })
    .filter(({ minDistance }) => minDistance <= MAX_DISTANCE_THRESHOLD) // Early exit: saltar trails muy lejanos
    .sort((a, b) => a.minDistance - b.minDistance); // Ordenar por distancia (cercanos primero)
  
  // Verificar colisión con trails cercanos primero (early exit cuando se encuentra colisión)
  for (const { trail, playerId } of trailsWithDistance) {
    // Verificar colisión con cada segmento del trail (saltando breaks/null)
    for (let i = 0; i < trail.length - 1; i++) {
      const segmentStart = trail[i];
      const segmentEnd = trail[i + 1];

      // Saltar si alguno de los puntos es null (break en el trail - gap)
      // Esto permite que los jugadores pasen a través de los gaps
      if (!segmentStart || !segmentEnd) {
        continue;
      }

      // Verificar si el nuevo segmento intersecta con este segmento del trail
      if (
        checkLineLineCollision(
          currentPos,
          newPos,
          segmentStart,
          segmentEnd
        )
      ) {
        return { collided: true, collidedWith: playerId };
      }
    }
  }

  return { collided: false };
}

/**
 * Verifica si el jugador colisiona consigo mismo (su propio trail)
 * IMPORTANTE: Salta segmentos con nulls (gaps) para permitir pasar a través de ellos
 */
export function checkSelfCollision(
  currentPos: Position,
  newPos: Position,
  ownTrail: Array<Position | null>
): boolean {
  // Necesitamos al menos 10 puntos válidos en el trail para evitar colisiones inmediatas
  const validPoints = ownTrail.filter(p => p !== null).length;
  if (validPoints < 10) {
    return false;
  }

  // Verificar colisión con el trail propio (saltando los últimos puntos)
  const skipPoints = 5; // Saltar los últimos N puntos para evitar colisiones inmediatas
  
  for (let i = 0; i < ownTrail.length - skipPoints - 1; i++) {
    const segmentStart = ownTrail[i];
    const segmentEnd = ownTrail[i + 1];

    // Saltar si alguno de los puntos es null (break en el trail - gap)
    // Esto permite que el jugador pase a través de sus propios gaps
    if (!segmentStart || !segmentEnd) {
      continue;
    }

    if (
      checkLineLineCollision(
        currentPos,
        newPos,
        segmentStart,
        segmentEnd
      )
    ) {
      return true;
    }
  }

  return false;
}

