// Sistema de captura de input del teclado y táctil
// Maneja las teclas y los toques, y los convierte en acciones del juego

export type InputAction = 'left' | 'right' | null;

export class InputManager {
  private keys: Set<string> = new Set();
  private activeTouches: Map<number, { x: number; y: number; side: 'left' | 'right' }> = new Map();
  private canvasElement: HTMLCanvasElement | null = null;
  private touchStateCallback: ((left: boolean, right: boolean) => void) | null = null;

  constructor(canvasId?: string) {
    if (canvasId) {
      this.canvasElement = document.getElementById(canvasId) as HTMLCanvasElement;
    }
    this.setupEventListeners();
  }

  /**
   * Establece un callback para notificar cambios en el estado de toques
   */
  onTouchStateChange(callback: (left: boolean, right: boolean) => void): void {
    this.touchStateCallback = callback;
  }

  /**
   * Configura los event listeners del teclado y táctiles
   */
  private setupEventListeners(): void {
    // Event listeners del teclado
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      // Prevenir scroll con arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    // Prevenir scroll con arrow keys (también en keydown general)
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    });

    // Event listeners táctiles
    // IMPORTANTE: Usar document.body o window para capturar todos los toques
    // ya que el canvas puede tener pointer-events: none
    const targetElement = document.body;
    
    targetElement.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevenir scroll y zoom
      this.handleTouchStart(e);
      this.notifyTouchState();
    }, { passive: false });

    targetElement.addEventListener('touchmove', (e) => {
      e.preventDefault(); // Prevenir scroll
      this.handleTouchMove(e);
      this.notifyTouchState();
    }, { passive: false });

    targetElement.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleTouchEnd(e);
      this.notifyTouchState();
    }, { passive: false });

    targetElement.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.handleTouchEnd(e);
      this.notifyTouchState();
    }, { passive: false });
  }

  /**
   * Determina en qué lado de la pantalla está un toque
   */
  private getTouchSide(x: number): 'left' | 'right' {
    const width = window.innerWidth;
    const midpoint = width / 2;
    return x < midpoint ? 'left' : 'right';
  }

  /**
   * Maneja el inicio de un toque
   */
  private handleTouchStart(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const side = this.getTouchSide(touch.clientX);
      this.activeTouches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        side: side
      });
    }
  }

  /**
   * Maneja el movimiento de un toque
   */
  private handleTouchMove(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const existingTouch = this.activeTouches.get(touch.identifier);
      if (existingTouch) {
        // Actualizar posición pero mantener el lado original donde comenzó el toque
        existingTouch.x = touch.clientX;
        existingTouch.y = touch.clientY;
      }
    }
  }

  /**
   * Maneja el fin de un toque
   */
  private handleTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.activeTouches.delete(touch.identifier);
    }
  }

  /**
   * Notifica el estado actual de los toques
   */
  private notifyTouchState(): void {
    if (this.touchStateCallback) {
      const leftTouches = Array.from(this.activeTouches.values()).filter(t => t.side === 'left');
      const rightTouches = Array.from(this.activeTouches.values()).filter(t => t.side === 'right');
      this.touchStateCallback(leftTouches.length > 0, rightTouches.length > 0);
    }
  }

  /**
   * Mapea una tecla a una acción
   */
  private getActionForKey(key: string): InputAction {
    // Teclas para girar izquierda
    if (key === 'a' || key === 'arrowleft') {
      return 'left';
    }
    
    // Teclas para girar derecha
    if (key === 'd' || key === 'arrowright') {
      return 'right';
    }

    return null;
  }

  /**
   * Obtiene la acción actual basada en las teclas presionadas o toques
   * Retorna la acción de la primera tecla relevante encontrada o el toque activo
   */
  getCurrentAction(): InputAction {
    // Primero verificar toques (tienen prioridad en móviles)
    const touchAction = this.getTouchAction();
    if (touchAction) {
      return touchAction;
    }

    // Si no hay toques, verificar teclas
    for (const key of this.keys) {
      const action = this.getActionForKey(key);
      if (action) {
        return action;
      }
    }

    return null;
  }

  /**
   * Obtiene la acción basada en los toques activos
   */
  private getTouchAction(): InputAction {
    if (this.activeTouches.size === 0) {
      return null;
    }

    // Si hay múltiples toques, verificar si están en ambos lados
    const leftTouches = Array.from(this.activeTouches.values()).filter(t => t.side === 'left');
    const rightTouches = Array.from(this.activeTouches.values()).filter(t => t.side === 'right');

    // Si hay toques en ambos lados, no retornar acción (boost se maneja en areBothKeysPressed)
    if (leftTouches.length > 0 && rightTouches.length > 0) {
      return null;
    }

    // Si solo hay toques en un lado, retornar esa acción
    if (leftTouches.length > 0) {
      return 'left';
    }

    if (rightTouches.length > 0) {
      return 'right';
    }

    return null;
  }
  
  /**
   * Verifica si ambas teclas de giro están presionadas o hay toques en ambos lados (para boost)
   */
  areBothKeysPressed(): boolean {
    // Verificar teclas
    const leftKeys = ['a', 'arrowleft'];
    const rightKeys = ['d', 'arrowright'];
    
    const hasLeftKey = leftKeys.some(key => this.keys.has(key));
    const hasRightKey = rightKeys.some(key => this.keys.has(key));
    
    // Verificar toques
    const leftTouches = Array.from(this.activeTouches.values()).filter(t => t.side === 'left');
    const rightTouches = Array.from(this.activeTouches.values()).filter(t => t.side === 'right');
    const hasLeftTouch = leftTouches.length > 0;
    const hasRightTouch = rightTouches.length > 0;
    
    // Boost si hay teclas en ambos lados O toques en ambos lados
    return (hasLeftKey && hasRightKey) || (hasLeftTouch && hasRightTouch);
  }

  /**
   * Verifica si una tecla específica está presionada
   */
  isKeyPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  /**
   * Limpia el estado del input
   */
  clear(): void {
    this.keys.clear();
    this.activeTouches.clear();
  }

  /**
   * Destruye los event listeners
   */
  destroy(): void {
    // Los event listeners se limpian automáticamente
    this.clear();
  }
}

