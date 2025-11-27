// Sistema de detección de colisiones
// Detecta colisiones con bordes y con trails

import type { Position } from '@shared/types';

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
 * Verifica si un punto está en una línea (con un margen de error)
 */
export function checkPointInLine(
  point: Position,
  lineStart: Position,
  lineEnd: Position,
  threshold: number = 1
): boolean {
  // Calcular distancia del punto a la línea
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number, yy: number;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance <= threshold;
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
 */
export function checkTrailCollision(
  currentPos: Position,
  newPos: Position,
  trails: Array<{ trail: Position[]; playerId: string }>,
  excludePlayerId?: string
): { collided: boolean; collidedWith?: string } {
  // Verificar colisión con cada trail
  for (const { trail, playerId } of trails) {
    // Saltar el trail del propio jugador si se especifica
    if (excludePlayerId && playerId === excludePlayerId) {
      continue;
    }

    // Verificar colisión con cada segmento del trail
    for (let i = 0; i < trail.length - 1; i++) {
      const segmentStart = trail[i];
      const segmentEnd = trail[i + 1];

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
 */
export function checkSelfCollision(
  currentPos: Position,
  newPos: Position,
  ownTrail: Position[]
): boolean {
  // Necesitamos al menos 10 puntos en el trail para evitar colisiones inmediatas
  if (ownTrail.length < 10) {
    return false;
  }

  // Verificar colisión con el trail propio (saltando los últimos puntos)
  const skipPoints = 5; // Saltar los últimos N puntos para evitar colisiones inmediatas
  
  for (let i = 0; i < ownTrail.length - skipPoints - 1; i++) {
    const segmentStart = ownTrail[i];
    const segmentEnd = ownTrail[i + 1];

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

