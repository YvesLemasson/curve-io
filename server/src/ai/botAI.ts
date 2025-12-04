// IA para bots - Sistema simple y efectivo
// Detecta colisiones cercanas, evita trails y bordes, y busca áreas abiertas

import type { Player, GameState, Position } from '../shared/types.js';
import type { BotDifficulty } from './botDifficulty.js';
import {
  checkBoundaryCollision,
  checkTrailCollision,
} from '../game/collision.js';
import { botLogger } from './botLogger.js';

export interface BotAction {
  direction: 'left' | 'right' | null;
  boost?: boolean;
}

/**
 * IA Simple - Detecta colisiones cercanas y evita
 * Versión básica: solo detecta y evita, sin pathfinding complejo
 */
export class BotAI {
  private difficulty: BotDifficulty;
  private readonly LOOK_AHEAD_DISTANCE = 180; // Píxeles a verificar adelante (aumentado 50% para compensar velocidad mayor: 120 * 1.5 = 180)
  
  // Dimensiones del mapa (deben coincidir con GameServer)
  private readonly MAP_WIDTH = 1920;
  private readonly MAP_HEIGHT = 1280;
  private readonly MAP_CENTER_X = 1920 / 2;
  private readonly MAP_CENTER_Y = 1280 / 2;

  constructor(difficulty: BotDifficulty) {
    this.difficulty = difficulty;
  }

  /**
   * Calcula la siguiente acción del bot
   * Detecta colisiones cercanas y evita
   */
  calculateAction(
    bot: Player,
    gameState: GameState,
    difficulty: BotDifficulty
  ): BotAction {
    this.difficulty = difficulty;

    // Calcular posición futura
    const futureX = bot.position.x + Math.cos(bot.angle) * this.LOOK_AHEAD_DISTANCE;
    const futureY = bot.position.y + Math.sin(bot.angle) * this.LOOK_AHEAD_DISTANCE;
    const futurePos: Position = { x: futureX, y: futureY };

    // Log de posición actual para debugging
    const boundaryDistances = this.getBoundaryDistances(bot.position);
    const minDistToBoundary = boundaryDistances.min;
    
    // Log cada 60 ticks para no saturar
    if (gameState.tick % 60 === 0) {
      botLogger.logDecision(
        bot.name || bot.id,
        null,
        `Pos: (${bot.position.x.toFixed(0)}, ${bot.position.y.toFixed(0)}), Dist al borde: ${minDistToBoundary.toFixed(0)}px`
      );
    }

    // 1. Verificar colisión con bordes
    const boundaryCollision = checkBoundaryCollision(futurePos, this.MAP_WIDTH, this.MAP_HEIGHT);
    if (boundaryCollision) {
      // Colisión con borde inminente - girar hacia el centro
      return {
        direction: this.getDirectionAwayFromBoundary(bot),
        boost: false,
      };
    }

    // 2. Verificar colisión con trails (otros jugadores)
    const otherTrails = gameState.players
      .filter((p) => p.id !== bot.id && p.alive && p.trail && p.trail.length > 0)
      .map((p) => ({
        trail: p.trail,
        playerId: p.id,
      }));

    // Verificar colisión directa con trails
    const trailCollision = checkTrailCollision(
      bot.position,
      futurePos,
      otherTrails,
      bot.id
    );

    if (trailCollision.collided) {
      // Antes de evadir, verificar si hay un gap cercano que podamos usar
      const nearbyGap = this.findNearbyGap(bot, otherTrails, futurePos);
      if (nearbyGap) {
        // Hay un gap cercano - intentar pasar por él
        const gapDirection = this.getDirectionToGap(bot, nearbyGap);
        if (gapDirection) {
          return {
            direction: gapDirection,
            boost: false,
          };
        }
      }
      
      // No hay gap viable - girar hacia la dirección más segura
      return {
        direction: this.getSafeDirection(bot, gameState),
        boost: false,
      };
    }

    // 2b. Verificar colisión con el propio trail del bot (self-collision)
    if (bot.trail && bot.trail.length > 10) {
      // Necesitamos al menos 10 puntos para evitar colisiones inmediatas
      const ownTrail = [{ trail: bot.trail, playerId: bot.id }];
      const selfTrailCollision = checkTrailCollision(
        bot.position,
        futurePos,
        ownTrail,
        undefined // No excluir, queremos verificar nuestro propio trail
      );

      if (selfTrailCollision.collided) {
        // Colisión con propio trail - girar hacia la dirección más segura
        return {
          direction: this.getSafeDirection(bot, gameState),
          boost: false,
        };
      }

      // Verificar proximidad al propio trail
      const ownTrailDistance = this.findNearestTrailDistance(bot, ownTrail);
      if (ownTrailDistance < 75) {
        // Muy cerca del propio trail - evadir (aumentado 50% para velocidad mayor: 50 * 1.5 = 75)
        return {
          direction: this.getSafeDirection(bot, gameState),
          boost: false,
        };
      }
    }

    // 3. Verificar si está cerca de bordes (aunque no haya colisión inmediata)
    // IMPORTANTE: Verificar ANTES de la detección preventiva de trails
    // para que los bots se alejen de bordes incluso si hay trails cerca
    // Determinar qué borde está más cerca
    const closestBoundary = this.getClosestBoundary(boundaryDistances);

    // Aumentado a 300px para activarse antes con velocidad 50% mayor (200 * 1.5 = 300)
    const BOUNDARY_AVOIDANCE_DISTANCE = 300;
    
    if (minDistToBoundary < BOUNDARY_AVOIDANCE_DISTANCE) {
      // Cerca de un borde - alejarse activamente hacia el centro
      const direction = this.getDirectionAwayFromBoundary(bot);
      
      // Log detallado para debugging
      botLogger.logBoundaryAvoidance(
        bot.name || bot.id,
        closestBoundary,
        minDistToBoundary,
        bot.position,
        direction
      );
      
      return {
        direction,
        boost: false,
      };
    }

    // 2c. Verificar proximidad a trails (detección preventiva)
    // Ahora se ejecuta DESPUÉS de verificar bordes, para que los bordes tengan prioridad
    // Buscar trails cercanos en un radio alrededor del bot
    const nearbyTrailDistance = this.findNearestTrailDistance(bot, otherTrails);
    if (nearbyTrailDistance < 90) {
      // Trail muy cercano - empezar a evadir preventivamente (aumentado 50% para velocidad mayor: 60 * 1.5 = 90)
      return {
        direction: this.getSafeDirection(bot, gameState),
        boost: false,
      };
    }

    // 4. No hay colisiones cercanas - comportamiento estratégico: moverse hacia áreas abiertas
    const strategicDirection = this.findOpenAreaDirection(bot, gameState);
    
    // Log cuando se usa comportamiento estratégico
    if (gameState.tick % 60 === 0) {
      const currentBoundaryDistances = this.getBoundaryDistances(bot.position);
      botLogger.logDecision(
        bot.name || bot.id,
        strategicDirection,
        `Comportamiento estratégico (sin colisiones cercanas, dist al borde: ${currentBoundaryDistances.min.toFixed(0)}px)`
      );
    }
    
    return {
      direction: strategicDirection,
      boost: false,
    };
  }

  /**
   * Obtiene la dirección para alejarse del borde más cercano
   */
  private getDirectionAwayFromBoundary(bot: Player): 'left' | 'right' {
    // Calcular ángulo hacia el centro
    const dx = this.MAP_CENTER_X - bot.position.x;
    const dy = this.MAP_CENTER_Y - bot.position.y;
    const angleToCenter = Math.atan2(dy, dx);

    // Calcular diferencia entre ángulo actual y ángulo al centro
    let angleDiff = angleToCenter - bot.angle;
    
    // Normalizar al rango [-π, π]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Log para debugging
    botLogger.logDirectionCalculation(
      bot.name || bot.id,
      bot.angle,
      angleToCenter,
      angleDiff,
      angleDiff > 0 ? 'right' : 'left'
    );

    // Girar hacia el centro
    // Si angleDiff > 0, necesitamos girar a la derecha (aumentar ángulo)
    // Si angleDiff < 0, necesitamos girar a la izquierda (disminuir ángulo)
    return angleDiff > 0 ? 'right' : 'left';
  }

  /**
   * Obtiene la dirección más segura (evalúa izquierda vs derecha)
   */
  private getSafeDirection(bot: Player, gameState: GameState): 'left' | 'right' {
    // Evaluar qué pasa si giramos izquierda
    const leftAngle = bot.angle - Math.PI / 30; // Giro pequeño
    const leftFutureX = bot.position.x + Math.cos(leftAngle) * this.LOOK_AHEAD_DISTANCE;
    const leftFutureY = bot.position.y + Math.sin(leftAngle) * this.LOOK_AHEAD_DISTANCE;
    const leftFuturePos: Position = { x: leftFutureX, y: leftFutureY };

    // Evaluar qué pasa si giramos derecha
    const rightAngle = bot.angle + Math.PI / 30; // Giro pequeño
    const rightFutureX = bot.position.x + Math.cos(rightAngle) * this.LOOK_AHEAD_DISTANCE;
    const rightFutureY = bot.position.y + Math.sin(rightAngle) * this.LOOK_AHEAD_DISTANCE;
    const rightFuturePos: Position = { x: rightFutureX, y: rightFutureY };

    // Verificar colisiones para ambas direcciones
    const leftBoundaryCollision = checkBoundaryCollision(leftFuturePos, this.MAP_WIDTH, this.MAP_HEIGHT);
    const rightBoundaryCollision = checkBoundaryCollision(rightFuturePos, this.MAP_WIDTH, this.MAP_HEIGHT);

    const otherTrails = gameState.players
      .filter((p) => p.id !== bot.id && p.alive)
      .map((p) => ({
        trail: p.trail,
        playerId: p.id,
      }));

    const leftTrailCollision = checkTrailCollision(
      bot.position,
      leftFuturePos,
      otherTrails,
      bot.id
    );
    const rightTrailCollision = checkTrailCollision(
      bot.position,
      rightFuturePos,
      otherTrails,
      bot.id
    );

    // Elegir la dirección más segura
    const leftSafe = !leftBoundaryCollision && !leftTrailCollision.collided;
    const rightSafe = !rightBoundaryCollision && !rightTrailCollision.collided;

    if (leftSafe && !rightSafe) return 'left';
    if (rightSafe && !leftSafe) return 'right';
    if (leftSafe && rightSafe) {
      // Ambas son seguras - elegir aleatoriamente o la que esté más hacia el centro
      return Math.random() < 0.5 ? 'left' : 'right';
    }

    // Ninguna es segura - elegir la que esté más hacia el centro
    return this.getDirectionAwayFromBoundary(bot);
  }

  /**
   * Encuentra la distancia al trail más cercano
   * Útil para detección preventiva de colisiones
   */
  private findNearestTrailDistance(
    bot: Player,
    trails: Array<{ trail: Array<Position | null>; playerId: string }>
  ): number {
    let minDistance = Infinity;

    for (const { trail } of trails) {
      for (const point of trail) {
        if (!point) continue; // Saltar nulls

        const dx = point.x - bot.position.x;
        const dy = point.y - bot.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
        }
      }
    }

    return minDistance;
  }

  /**
   * Encuentra la dirección hacia el área más abierta
   * Evalúa izquierda, derecha y recto, y elige la que tenga más espacio disponible
   */
  private findOpenAreaDirection(
    bot: Player,
    gameState: GameState
  ): 'left' | 'right' | null {
    // Evaluar 3 direcciones: izquierda, derecha, y recto
    const directions: Array<{ name: 'left' | 'right' | null; angle: number }> = [
      { name: 'left', angle: bot.angle - Math.PI / 20 }, // Giro suave a la izquierda
      { name: 'right', angle: bot.angle + Math.PI / 20 }, // Giro suave a la derecha
      { name: null, angle: bot.angle }, // Mantener dirección actual
    ];

    const scores: Array<{ direction: 'left' | 'right' | null; score: number }> = [];

    for (const dir of directions) {
      const score = this.evaluateDirectionScore(bot, dir.angle, gameState);
      scores.push({ direction: dir.name, score });
    }

    // Ordenar por score (mayor = mejor)
    scores.sort((a, b) => b.score - a.score);

    // Si la mejor dirección es significativamente mejor (> 10 puntos de diferencia), usarla
    // Reducido el umbral para ser más proactivo en moverse hacia el centro y alejarse de bordes
    if (scores[0].score > scores[1].score + 10) {
      return scores[0].direction;
    }

    // Si las puntuaciones son similares pero hay una dirección hacia el centro, preferirla
    // Verificar si alguna dirección va hacia el centro
    const dx = this.MAP_CENTER_X - bot.position.x;
    const dy = this.MAP_CENTER_Y - bot.position.y;
    const angleToCenter = Math.atan2(dy, dx);
    
    for (const scoreEntry of scores) {
      if (scoreEntry.direction === null) continue;
      
      const testAngle = scoreEntry.direction === 'left' 
        ? bot.angle - Math.PI / 20 
        : bot.angle + Math.PI / 20;
      const angleDiff = Math.abs(testAngle - angleToCenter);
      const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
      
      if (normalizedDiff < Math.PI / 6) {
        // Esta dirección va hacia el centro - preferirla
        return scoreEntry.direction;
      }
    }

    // Si las puntuaciones son similares, mantener dirección actual
    return null;
  }

  /**
   * Evalúa qué tan "abierta" es una dirección
   * Retorna un score: mayor = más espacio disponible
   */
  private evaluateDirectionScore(
    bot: Player,
    angle: number,
    gameState: GameState
  ): number {
    let score = 100; // Score base

    // Simular movimiento en esta dirección por múltiples pasos
    const steps = 5; // Evaluar 5 pasos adelante
    const stepDistance = 40; // 40px por paso

    for (let step = 1; step <= steps; step++) {
      const checkDistance = stepDistance * step;
      const checkX = bot.position.x + Math.cos(angle) * checkDistance;
      const checkY = bot.position.y + Math.sin(angle) * checkDistance;
      const checkPos: Position = { x: checkX, y: checkY };

      // Penalizar si está cerca de bordes (más agresivo)
      const checkBoundaryDistances = this.getBoundaryDistances(checkPos);
      const minDistToBoundary = checkBoundaryDistances.min;

      // Calcular distancia al centro para bonus adicional
      const distToCenter = Math.sqrt(
        Math.pow(checkX - this.MAP_CENTER_X, 2) + Math.pow(checkY - this.MAP_CENTER_Y, 2)
      );
      const maxDistToCenter = Math.sqrt(Math.pow(this.MAP_CENTER_X, 2) + Math.pow(this.MAP_CENTER_Y, 2)); // Distancia máxima al centro (esquina)
      const centerRatio = 1 - (distToCenter / maxDistToCenter); // 0 = en el borde, 1 = en el centro

      // Penalizaciones más agresivas y graduales por estar cerca de bordes
      if (minDistToBoundary < 50) {
        score -= 100; // Muy cerca del borde (penalización muy fuerte)
      } else if (minDistToBoundary < 100) {
        score -= 70; // Cerca del borde (penalización muy fuerte)
      } else if (minDistToBoundary < 150) {
        score -= 50; // Moderadamente cerca (penalización fuerte)
      } else if (minDistToBoundary < 200) {
        score -= 35; // Algo cerca (penalización media-fuerte)
      } else if (minDistToBoundary < 250) {
        score -= 20; // Lejos pero no en el centro (penalización media)
      } else if (minDistToBoundary < 300) {
        score -= 10; // Moderadamente lejos (penalización suave)
      } else if (minDistToBoundary < 400) {
        score -= 5; // Lejos pero no en el centro (penalización muy suave)
      }
      
      // Bonus por estar cerca del centro (más agresivo)
      if (centerRatio > 0.8) {
        score += 40; // Muy cerca del centro (bonus muy grande)
      } else if (centerRatio > 0.7) {
        score += 30; // Muy cerca del centro (bonus grande)
      } else if (centerRatio > 0.5) {
        score += 20; // Cerca del centro (bonus medio)
      } else if (centerRatio > 0.3) {
        score += 10; // Moderadamente cerca del centro (bonus pequeño)
      } else if (centerRatio > 0.1) {
        score += 3; // Algo cerca del centro (bonus muy pequeño)
      }

      // Penalizar si está cerca de trails
      const otherTrails = gameState.players
        .filter((p) => p.id !== bot.id && p.alive && p.trail && p.trail.length > 0)
        .map((p) => ({
          trail: p.trail,
          playerId: p.id,
        }));

      const nearestTrailDist = this.getDistanceToNearestTrail(checkPos, otherTrails);
      
      if (nearestTrailDist < 60) {
        score -= 25; // Muy cerca de un trail (aumentado 50%: 40 * 1.5 = 60)
      } else if (nearestTrailDist < 120) {
        score -= 10; // Cerca de un trail (aumentado 50%: 80 * 1.5 = 120)
      } else if (nearestTrailDist > 150) {
        score += 5; // Lejos de trails (bonus)
      }

      // Verificar colisión directa en este paso
      if (step === 1) {
        // Solo verificar colisión en el primer paso (más importante)
        const boundaryCollision = checkBoundaryCollision(checkPos, this.MAP_WIDTH, this.MAP_HEIGHT);
        if (boundaryCollision) {
          score -= 50; // Colisión con borde
        }

        const trailCollision = checkTrailCollision(
          bot.position,
          checkPos,
          otherTrails,
          bot.id
        );
        if (trailCollision.collided) {
          score -= 50; // Colisión con trail
        }
      }
    }

    // Bonus si la dirección lleva hacia el centro del mapa (más agresivo)
    const dx = this.MAP_CENTER_X - bot.position.x;
    const dy = this.MAP_CENTER_Y - bot.position.y;
    const angleToCenter = Math.atan2(dy, dx);
    const angleDiff = Math.abs(angle - angleToCenter);
    const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

    // Bonus más fuerte y gradual según qué tan bien alineado esté con el centro
    if (normalizedDiff < Math.PI / 12) {
      score += 25; // Muy bien alineado con el centro (bonus grande)
    } else if (normalizedDiff < Math.PI / 6) {
      score += 15; // Bien alineado con el centro (bonus medio)
    } else if (normalizedDiff < Math.PI / 4) {
      score += 8; // Moderadamente alineado (bonus pequeño)
    } else if (normalizedDiff < Math.PI / 2) {
      score += 3; // Algo alineado (bonus muy pequeño)
    }
    
    // Penalizar si la dirección aleja del centro
    if (normalizedDiff > (3 * Math.PI) / 4) {
      score -= 15; // Va alejándose del centro (penalización)
    }

    return score;
  }

  /**
   * Obtiene la distancia al trail más cercano desde una posición
   */
  private getDistanceToNearestTrail(
    position: Position,
    trails: Array<{ trail: Array<Position | null>; playerId: string }>
  ): number {
    let minDistance = Infinity;

    for (const { trail } of trails) {
      for (const point of trail) {
        if (!point) continue;

        const dx = point.x - position.x;
        const dy = point.y - position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
        }
      }
    }

    return minDistance === Infinity ? 1000 : minDistance; // Si no hay trails, retornar distancia grande
  }

  /**
   * Encuentra un gap cercano en los trails que sea lo suficientemente grande para pasar
   * Mejorado: busca gaps de forma más precisa y verifica que realmente se pueda pasar
   */
  private findNearbyGap(
    bot: Player,
    trails: Array<{ trail: Array<Position | null>; playerId: string }>,
    futurePos: Position
  ): { gapStart: Position; gapEnd: Position; gapCenter: Position; distance: number } | null {
    const MAX_GAP_DISTANCE = 180; // Buscar gaps dentro de 180px (aumentado 50% para velocidad mayor: 120 * 1.5 = 180)
    const MIN_GAP_SIZE = 60; // El gap debe tener al menos 60px de ancho (aumentado para evitar colisiones)

    let bestGap: { gapStart: Position; gapEnd: Position; gapCenter: Position; distance: number } | null = null;
    let bestGapScore = Infinity;

    for (const { trail } of trails) {
      // Buscar gaps (nulls) en el trail
      // Un gap es una secuencia de nulls entre dos puntos válidos
      let gapStartIndex = -1;
      
      for (let i = 0; i < trail.length; i++) {
        const point = trail[i];
        
        // Si encontramos un null, puede ser el inicio de un gap
        if (point === null && gapStartIndex === -1) {
          gapStartIndex = i;
        }
        // Si encontramos un punto válido después de nulls, tenemos un gap completo
        else if (point !== null && gapStartIndex !== -1) {
          // Encontrar el último punto válido antes del gap
          let beforeGap: Position | null = null;
          for (let j = gapStartIndex - 1; j >= 0; j--) {
            if (trail[j] !== null) {
              beforeGap = trail[j] as Position;
              break;
            }
          }
          
          // El punto actual es después del gap
          const afterGap = point as Position;
          
          if (!beforeGap) {
            gapStartIndex = -1;
            continue; // No hay punto antes del gap, no es un gap válido
          }

          // Calcular tamaño del gap (distancia entre punto antes y después)
          const gapSize = Math.sqrt(
            Math.pow(afterGap.x - beforeGap.x, 2) + Math.pow(afterGap.y - beforeGap.y, 2)
          );

          // Solo considerar gaps lo suficientemente grandes
          if (gapSize >= MIN_GAP_SIZE) {
            // Calcular punto medio del gap
            const gapCenter: Position = {
              x: (beforeGap.x + afterGap.x) / 2,
              y: (beforeGap.y + afterGap.y) / 2,
            };

            // Calcular distancia al centro del gap
            const dx = gapCenter.x - bot.position.x;
            const dy = gapCenter.y - bot.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= MAX_GAP_DISTANCE) {
              // Verificar que el gap esté en una dirección razonable (no muy atrás)
              const angleToGap = Math.atan2(dy, dx);
              const angleDiff = Math.abs(angleToGap - bot.angle);
              const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

              // Solo considerar gaps que estén en un ángulo razonable (no más de 90 grados a los lados)
              if (normalizedDiff < Math.PI / 2) {
                // Calcular score: distancia al gap - bonus por tamaño (menor score = mejor)
                const score = distance - (gapSize * 0.3); // Bonus por gap más grande

                if (score < bestGapScore) {
                  bestGapScore = score;
                  bestGap = {
                    gapStart: beforeGap,
                    gapEnd: afterGap,
                    gapCenter,
                    distance,
                  };
                }
              }
            }
          }

          gapStartIndex = -1; // Reset para buscar el siguiente gap
        }
      }
    }

    return bestGap;
  }

  /**
   * Calcula la dirección necesaria para pasar por un gap
   * Mejorado: verifica que realmente se pueda pasar de forma segura
   */
  private getDirectionToGap(
    bot: Player,
    gap: { gapStart: Position; gapEnd: Position; gapCenter: Position; distance: number }
  ): 'left' | 'right' | null {
    // Calcular ángulo hacia el centro del gap
    const dx = gap.gapCenter.x - bot.position.x;
    const dy = gap.gapCenter.y - bot.position.y;
    const angleToGap = Math.atan2(dy, dx);

    // Calcular diferencia entre ángulo actual y ángulo al gap
    const angleDiff = angleToGap - bot.angle;
    const normalizedDiff = ((angleDiff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // Si el gap está muy atrás (más de 90 grados), no intentar pasar
    if (normalizedDiff > (3 * Math.PI) / 4 && normalizedDiff < (5 * Math.PI) / 4) {
      return null; // Gap está muy atrás
    }

    // Si el gap está muy cerca (< 75px), ser más conservador (aumentado 50%: 50 * 1.5 = 75)
    if (gap.distance < 75) {
      // Solo intentar si el gap está directamente adelante o ligeramente a los lados
      if (normalizedDiff > Math.PI / 3 && normalizedDiff < (5 * Math.PI) / 3) {
        return null; // Gap muy cerca pero no en buena posición
      }
    }

    // Verificar que el gap esté en una dirección alcanzable
    // Si está muy a los lados (> 60 grados), puede ser difícil pasar
    if (normalizedDiff > Math.PI / 3 && normalizedDiff < (5 * Math.PI) / 3) {
      // Gap está a más de 60 grados a los lados - verificar si es seguro
      // Por ahora, solo intentar si está relativamente cerca
      if (gap.distance > 80) {
        return null; // Gap muy a los lados y lejos - no intentar
      }
    }

    // Girar hacia el gap
    return normalizedDiff > Math.PI ? 'left' : 'right';
  }

  /**
   * Calcula las distancias a cada borde del mapa
   */
  private getBoundaryDistances(position: Position): {
    left: number;
    right: number;
    top: number;
    bottom: number;
    min: number;
  } {
    const left = position.x;
    const right = this.MAP_WIDTH - position.x;
    const top = position.y;
    const bottom = this.MAP_HEIGHT - position.y;
    const min = Math.min(left, right, top, bottom);
    
    return { left, right, top, bottom, min };
  }

  /**
   * Determina qué borde está más cerca
   */
  private getClosestBoundary(distances: { left: number; right: number; top: number; bottom: number; min: number }): string {
    if (distances.min === distances.right) return 'right';
    if (distances.min === distances.top) return 'top';
    if (distances.min === distances.bottom) return 'bottom';
    return 'left';
  }
}

