// Sistema de renderizado Canvas
// Maneja el canvas y todas las operaciones de dibujo

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
   */
  drawTrail(
    trail: Array<{ x: number; y: number } | null>,
    color: string,
    lineWidth: number = 2
  ): void {
    if (trail.length < 2) return;

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
