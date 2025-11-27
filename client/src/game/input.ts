// Sistema de captura de input del teclado
// Maneja las teclas y las convierte en acciones del juego

export type InputAction = 'left' | 'right' | null;

export class InputManager {
  private keys: Set<string> = new Set();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Configura los event listeners del teclado
   */
  private setupEventListeners(): void {
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
   * Obtiene la acción actual basada en las teclas presionadas
   * Retorna la acción de la primera tecla relevante encontrada
   */
  getCurrentAction(): InputAction {
    // Verificar teclas actualmente presionadas
    for (const key of this.keys) {
      const action = this.getActionForKey(key);
      if (action) {
        return action;
      }
    }

    return null;
  }
  
  /**
   * Verifica si ambas teclas de giro están presionadas (para boost)
   */
  areBothKeysPressed(): boolean {
    const leftKeys = ['a', 'arrowleft'];
    const rightKeys = ['d', 'arrowright'];
    
    const hasLeft = leftKeys.some(key => this.keys.has(key));
    const hasRight = rightKeys.some(key => this.keys.has(key));
    
    return hasLeft && hasRight;
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
  }

  /**
   * Destruye los event listeners
   */
  destroy(): void {
    // Los event listeners se limpian automáticamente
    this.clear();
  }
}

