// Utilidades para generar colores para bots

// Colores disponibles para bots (8 colores básicos)
const BOT_COLORS = [
  '#ff0000', // Rojo
  '#00ff00', // Verde
  '#0000ff', // Azul
  '#ffff00', // Amarillo
  '#ff00ff', // Magenta
  '#00ffff', // Cyan
  '#ff8000', // Naranja
  '#8000ff', // Morado
];

/**
 * Obtiene un color aleatorio para un bot
 * @param usedColors - Colores ya en uso (opcional)
 * @returns Color hexadecimal
 */
export function getRandomColor(usedColors?: Set<string>): string {
  if (!usedColors || usedColors.size === 0) {
    return BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];
  }

  // Buscar un color no usado
  const availableColors = BOT_COLORS.filter(c => !usedColors.has(c));
  
  if (availableColors.length > 0) {
    return availableColors[Math.floor(Math.random() * availableColors.length)];
  }

  // Si todos están usados, devolver uno aleatorio
  return BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];
}


