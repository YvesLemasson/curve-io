/**
 * Utilidad de testing para agregar Loops a usuarios
 * 
 * Uso desde la consola del navegador:
 * 
 * 1. Importar en la consola (si estás en desarrollo):
 *    import { addTestLoops, getMyLoops, getMyUserId } from './utils/testLoops';
 * 
 * 2. O exponer globalmente en desarrollo:
 *    window.testLoops = { addTestLoops, getMyLoops, getMyUserId };
 * 
 * 3. Luego usar:
 *    await window.testLoops.addTestLoops(1000);
 *    await window.testLoops.getMyLoops();
 */

import { supabase } from '../config/supabase';
import { PremiumModel } from '../models/premiumModel';

/**
 * Obtiene el ID del usuario actual autenticado
 */
export async function getMyUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('No hay usuario autenticado');
    return null;
  }
  return user.id;
}

/**
 * Obtiene el balance de Loops del usuario actual
 */
export async function getMyLoops(): Promise<number> {
  const userId = await getMyUserId();
  if (!userId) {
    console.warn('No hay usuario autenticado');
    return 0;
  }
  
  const loops = await PremiumModel.getUserLoops(userId);
  console.log(`Tu balance actual de Loops: ${loops}`);
  return loops;
}

/**
 * Agrega Loops al usuario actual (para testing)
 * @param amount Cantidad de loops a agregar
 * @param description Descripción opcional de la transacción
 */
export async function addTestLoops(
  amount: number = 1000,
  description: string = 'Loops de prueba para testing'
): Promise<number> {
  const userId = await getMyUserId();
  if (!userId) {
    console.error('Error: No hay usuario autenticado. Por favor inicia sesión primero.');
    throw new Error('Usuario no autenticado');
  }

  if (amount <= 0) {
    console.error('Error: La cantidad debe ser positiva');
    throw new Error('Cantidad inválida');
  }

  try {
    console.log(`Agregando ${amount} loops a tu cuenta...`);
    const newBalance = await PremiumModel.addLoops(
      userId,
      amount,
      'reward',
      'test_bonus',
      description
    );
    console.log(`✅ ¡Éxito! Tu nuevo balance es: ${newBalance} loops`);
    return newBalance;
  } catch (error: any) {
    console.error('Error agregando loops:', error);
    throw error;
  }
}

/**
 * Expone las funciones globalmente en desarrollo para uso desde la consola
 */
if (import.meta.env.DEV) {
  (window as any).testLoops = {
    addTestLoops,
    getMyLoops,
    getMyUserId,
  };
  
  console.log(
    '%c🔧 Utilidades de Testing de Loops disponibles!',
    'color: #4CAF50; font-weight: bold; font-size: 14px;'
  );
  console.log(
    '%cUsa: window.testLoops.addTestLoops(1000) para agregar loops',
    'color: #2196F3; font-size: 12px;'
  );
  console.log(
    '%cUsa: window.testLoops.getMyLoops() para ver tu balance',
    'color: #2196F3; font-size: 12px;'
  );
}





