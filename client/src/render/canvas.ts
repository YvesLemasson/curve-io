// Sistema de renderizado Canvas
// Maneja el canvas y todas las operaciones de dibujo

import type { TrailType, TrailEffectConfig } from "@shared/types";

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;

  constructor(canvasId: string = "gameCanvas") {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas con id "${canvasId}" no encontrado`);
    }

    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No se pudo obtener contexto 2D del canvas");
    }

    this.ctx = ctx;
    this.resize();

    // Ajustar tamaño cuando cambia la ventana
    window.addEventListener("resize", () => this.resize());
  }

  /**
   * Ajusta el tamaño del canvas manteniendo proporción 3:2 (apaisado)
   */
  private resize(): void {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Proporción deseada: 3:2 (ancho:alto)
    const aspectRatio = 3 / 2;

    // Calcular dimensiones manteniendo la proporción
    let canvasWidth = windowWidth;
    let canvasHeight = windowWidth / aspectRatio;

    // Si el alto calculado es mayor que el disponible, ajustar por alto
    if (canvasHeight > windowHeight) {
      canvasHeight = windowHeight;
      canvasWidth = windowHeight * aspectRatio;
    }

    this.width = canvasWidth;
    this.height = canvasHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Centrar el canvas en la ventana
    this.canvas.style.position = "absolute";
    this.canvas.style.left = `${(windowWidth - canvasWidth) / 2}px`;
    this.canvas.style.top = `${(windowHeight - canvasHeight) / 2}px`;
  }

  /**
   * Limpia el canvas (pinta todo de negro) y dibuja el borde
   */
  clear(): void {
    // Limpiar fondo negro
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Dibujar borde blanco
    this.drawBorder();
  }

  /**
   * Dibuja un borde alrededor del canvas
   */
  private drawBorder(): void {
    const borderWidth = 4;
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = borderWidth;
    this.ctx.strokeRect(
      borderWidth / 2,
      borderWidth / 2,
      this.width - borderWidth,
      this.height - borderWidth
    );
  }

  /**
   * Dibuja una línea entre dos puntos
   */
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string = "#ffffff",
    lineWidth: number = 2
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  /**
   * Dibuja el trail completo de un jugador
   * Respeta los breaks (null) en el trail para crear huecos
   * Soporta diferentes tipos de efectos premium
   */
  drawTrail(
    trail: Array<{ x: number; y: number } | null>,
    color: string,
    lineWidth: number = 2,
    trailType: TrailType = "normal",
    effectConfig?: TrailEffectConfig
  ): void {
    if (trail.length < 2) return;

    switch (trailType) {
      case "normal":
        this.drawNormalTrail(trail, color, lineWidth);
        break;
      case "particles":
        this.drawParticleTrail(trail, color, lineWidth, effectConfig);
        break;
      case "fire":
        this.drawFireTrail(trail, color, lineWidth, effectConfig);
        break;
      default:
        this.drawNormalTrail(trail, color, lineWidth);
    }
  }

  /**
   * Dibuja un trail normal (básico)
   */
  private drawNormalTrail(
    trail: Array<{ x: number; y: number } | null>,
    color: string,
    lineWidth: number
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Dibujar segmentos continuos, saltando los breaks (null)
    let segmentStart = -1;

    for (let i = 0; i < trail.length; i++) {
      const point = trail[i];

      // Si encontramos un break (null) o el punto es null
      if (point === null) {
        // Si hay un segmento activo, dibujarlo
        if (segmentStart >= 0 && i > segmentStart + 1) {
          this.ctx.beginPath();
          const startPoint = trail[segmentStart];
          if (startPoint) {
            this.ctx.moveTo(startPoint.x, startPoint.y);

            for (let j = segmentStart + 1; j < i; j++) {
              const p = trail[j];
              if (p) {
                this.ctx.lineTo(p.x, p.y);
              }
            }
            this.ctx.stroke();
          }
        }
        segmentStart = -1; // Resetear segmento
      } else {
        // Si es el primer punto válido después de un break
        if (segmentStart === -1) {
          segmentStart = i;
        }
      }
    }

    // Dibujar el último segmento si existe
    if (segmentStart >= 0 && segmentStart < trail.length - 1) {
      this.ctx.beginPath();
      const startPoint = trail[segmentStart];
      if (startPoint) {
        this.ctx.moveTo(startPoint.x, startPoint.y);

        for (let i = segmentStart + 1; i < trail.length; i++) {
          const point = trail[i];
          if (point) {
            this.ctx.lineTo(point.x, point.y);
          }
        }
        this.ctx.stroke();
      }
    }
  }

  /**
   * Dibuja un trail con partículas brillantes y línea base blanca
   * Las partículas mantienen un espaciado constante para densidad uniforme
   * Respeta los gaps (nulls) en el trail
   */
  private drawParticleTrail(
    trail: Array<{ x: number; y: number } | null>,
    color: string,
    lineWidth: number,
    config?: TrailEffectConfig
  ): void {
    // Dibujar trail base con color configurado (por defecto color del jugador)
    const trailColor = config?.trailColor || color;
    this.drawNormalTrail(trail, trailColor, lineWidth);

    // Dividir el trail en segmentos continuos (separados por nulls/gaps)
    const segments: Array<Array<{ x: number; y: number }>> = [];
    let currentSegment: Array<{ x: number; y: number }> = [];

    for (const point of trail) {
      if (point === null) {
        // Gap encontrado - guardar segmento actual si tiene puntos
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      } else {
        currentSegment.push(point);
      }
    }

    // Agregar el último segmento si existe
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    const particleSize = config?.particleSize || 3;
    // Espaciado fijo entre partículas (en píxeles) - densidad constante
    const particleSpacing = config?.particleCount || 20; // Espaciado en píxeles

    // Guardar estado del contexto
    this.ctx.save();

    // Dibujar partículas en cada segmento (respetando gaps)
    for (const segment of segments) {
      if (segment.length < 2) continue;

      // Calcular la longitud total del segmento y posiciones acumuladas
      let totalLength = 0;
      const segmentLengths: number[] = [0];

      for (let i = 1; i < segment.length; i++) {
        const dx = segment[i].x - segment[i - 1].x;
        const dy = segment[i].y - segment[i - 1].y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);
        totalLength += segmentLength;
        segmentLengths.push(totalLength);
      }

      if (totalLength === 0) continue;

      // Colocar partículas con espaciado constante a lo largo del segmento
      let currentDistance = particleSpacing; // Empezar desde el espaciado (no desde 0)
      let pointIndex = 0;

      while (currentDistance < totalLength) {
        // Encontrar el punto donde debería estar esta partícula
        while (
          pointIndex < segmentLengths.length - 1 &&
          segmentLengths[pointIndex + 1] < currentDistance
        ) {
          pointIndex++;
        }

        if (pointIndex >= segment.length - 1) break;

        // Interpolar posición dentro del segmento
        const segmentStart = segmentLengths[pointIndex];
        const segmentEnd = segmentLengths[pointIndex + 1];
        const segmentLength = segmentEnd - segmentStart;

        if (segmentLength > 0) {
          const t = (currentDistance - segmentStart) / segmentLength;
          const p1 = segment[pointIndex];
          const p2 = segment[pointIndex + 1];

          const x = p1.x + (p2.x - p1.x) * t;
          const y = p1.y + (p2.y - p1.y) * t;

          // Dibujar partícula brillante con efecto de resplandor más sutil
          // Primero dibujar un círculo pequeño con opacidad para el resplandor
          this.ctx.globalAlpha = 0.2;
          this.ctx.fillStyle = color;
          this.ctx.beginPath();
          this.ctx.arc(x, y, particleSize * 1.5, 0, Math.PI * 2);
          this.ctx.fill();

          // Luego dibujar el círculo principal con resplandor más sutil
          this.ctx.globalAlpha = 1.0;
          this.ctx.fillStyle = color;
          this.ctx.shadowBlur = 8;
          this.ctx.shadowColor = color;
          this.ctx.beginPath();
          this.ctx.arc(x, y, particleSize, 0, Math.PI * 2);
          this.ctx.fill();

          // Dibujar un punto pequeño brillante en el centro (opcional, más sutil)
          this.ctx.shadowBlur = 0;
          this.ctx.globalAlpha = 0.6;
          this.ctx.fillStyle = "#ffffff";
          this.ctx.beginPath();
          this.ctx.arc(x, y, particleSize * 0.3, 0, Math.PI * 2);
          this.ctx.fill();
        }

        currentDistance += particleSpacing;
      }
    }

    // Restaurar estado del contexto
    this.ctx.restore();
  }

  /**
   * Dibuja un trail de fuego con gradiente rojo-naranja-amarillo y resplandor
   * Respeta los gaps (nulls) en el trail
   */
  private drawFireTrail(
    trail: Array<{ x: number; y: number } | null>,
    _color: string, // No usado - usamos colores de fuego fijos
    lineWidth: number,
    config?: TrailEffectConfig
  ): void {
    // Dividir el trail en segmentos continuos (separados por nulls/gaps)
    const segments: Array<Array<{ x: number; y: number }>> = [];
    let currentSegment: Array<{ x: number; y: number }> = [];

    for (const point of trail) {
      if (point === null) {
        // Gap encontrado - guardar segmento actual si tiene puntos
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      } else {
        currentSegment.push(point);
      }
    }

    // Agregar el último segmento si existe
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    // Guardar estado del contexto
    this.ctx.save();

    // Colores de fuego
    const fireColors = {
      red: "#ff0000",
      orange: "#ff6600",
      yellow: "#ffaa00",
      brightYellow: "#ffff00",
    };

    const glowIntensity = config?.glowIntensity || 4; // Reducido para menos grosor
    const baseLineWidth = lineWidth * 0.6; // Más fino que el trail normal (60% del ancho)

    // Dibujar cada segmento con efecto de fuego
    for (const segment of segments) {
      if (segment.length < 2) continue;

      // Calcular la longitud total del segmento
      let totalLength = 0;
      const segmentLengths: number[] = [0];

      for (let i = 1; i < segment.length; i++) {
        const dx = segment[i].x - segment[i - 1].x;
        const dy = segment[i].y - segment[i - 1].y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);
        totalLength += segmentLength;
        segmentLengths.push(totalLength);
      }

      if (totalLength === 0) continue;

      // Dibujar múltiples capas para efecto de resplandor (de afuera hacia adentro)
      const layers = 1;
      for (let layer = 0; layer < layers; layer++) {
        const layerWidth = baseLineWidth + (glowIntensity - layer * 2.5); // Reducido incremento de 5 a 2.5
        const layerGlow = glowIntensity - layer * 2.5; // Reducido de 5 a 2.5
        const layerAlpha = 1.0 - layer * 0.2;

        this.ctx.globalAlpha = layerAlpha;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.lineWidth = layerWidth;
        this.ctx.shadowBlur = layerGlow;
        this.ctx.shadowColor = fireColors.orange;

        // Dibujar el segmento con gradiente a lo largo del trail
        this.ctx.beginPath();
        this.ctx.moveTo(segment[0].x, segment[0].y);

        let accumulatedLength = 0;
        for (let i = 1; i < segment.length; i++) {
          const dx = segment[i].x - segment[i - 1].x;
          const dy = segment[i].y - segment[i - 1].y;
          const segmentLength = Math.sqrt(dx * dx + dy * dy);
          accumulatedLength += segmentLength;

          // Calcular color basado en posición en el trail (0 = rojo, 1 = amarillo)
          const t = Math.min(accumulatedLength / totalLength, 1);
          let fireColor: string;

          if (t < 0.3) {
            // Rojo a naranja
            const localT = t / 0.3;
            fireColor = this.interpolateColor(
              fireColors.red,
              fireColors.orange,
              localT
            );
          } else if (t < 0.7) {
            // Naranja a amarillo
            const localT = (t - 0.3) / 0.4;
            fireColor = this.interpolateColor(
              fireColors.orange,
              fireColors.yellow,
              localT
            );
          } else {
            // Amarillo a amarillo brillante
            const localT = (t - 0.7) / 0.3;
            fireColor = this.interpolateColor(
              fireColors.yellow,
              fireColors.brightYellow,
              localT
            );
          }

          this.ctx.strokeStyle = fireColor;
          this.ctx.lineTo(segment[i].x, segment[i].y);
        }

        this.ctx.stroke();
      }
    }

    // Restaurar estado del contexto
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;
    this.ctx.restore();
  }

  /**
   * Interpola entre dos colores hex
   */
  private interpolateColor(color1: string, color2: string, t: number): string {
    // Convertir hex a RGB
    const hex1 = color1.replace("#", "");
    const hex2 = color2.replace("#", "");
    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);

    // Interpolar
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    // Convertir de vuelta a hex
    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  /**
   * Dibuja un punto (útil para debugging)
   */
  drawPoint(
    x: number,
    y: number,
    color: string = "#ffffff",
    size: number = 4
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Obtiene el ancho del canvas
   */
  getWidth(): number {
    return this.width;
  }

  /**
   * Obtiene el alto del canvas
   */
  getHeight(): number {
    return this.height;
  }

  /**
   * Obtiene el contexto 2D (para operaciones avanzadas)
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}
