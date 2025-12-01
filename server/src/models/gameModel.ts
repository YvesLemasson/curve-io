// Modelo para interactuar con partidas en Supabase
import { supabase } from '../config/supabase.js';
import type { Database } from '../config/supabase.js';

type Game = Database['public']['Tables']['games']['Row'];
type GameInsert = Database['public']['Tables']['games']['Insert'];
type GameParticipant = Database['public']['Tables']['game_participants']['Row'];
type GameParticipantInsert = Database['public']['Tables']['game_participants']['Insert'];

export interface GameResult {
  gameId: string;
  participants: Array<{
    userId: string;
    score: number;
    position: number;
  }>;
  winnerId: string | null;
  startedAt: string;
  endedAt: string;
}

export class GameModel {
  /**
   * Busca una partida disponible en estado "waiting" o "lobby"
   * Si no existe, crea una nueva
   * 
   * NOTA: Por ahora, siempre creamos una nueva partida para evitar problemas
   * con la reutilización de game_id y el trigger de ELO
   */
  static async findOrCreateWaitingGame(): Promise<string> {
    // Por ahora, siempre crear una nueva partida para evitar problemas
    // con participantes duplicados y el trigger de ELO
    // En el futuro, se puede implementar la lógica de buscar partidas existentes
    // si se quiere permitir que múltiples grupos de jugadores se unan a la misma partida
    
    const { data: newGame, error: createError } = await supabase
      .from('games')
      .insert({
        status: 'waiting',
        // total_players: null, // Se actualizará cuando se inicie el juego (si la columna existe)
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating game:', createError);
      throw new Error(`Failed to create game: ${createError.message}`);
    }

    console.log(`✨ Nueva partida creada: ${newGame.id}`);
    return newGame.id;
    
    /* Código comentado para buscar partidas existentes (para implementar en el futuro):
    
    // Buscar partida en estado "waiting" o "lobby" que no tenga participantes aún
    // o que tenga menos de MAX_PLAYERS participantes
    const { data: existingGames, error: findError } = await supabase
      .from('games')
      .select(`
        id,
        game_participants(count)
      `)
      .in('status', ['waiting', 'lobby'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (!findError && existingGames && existingGames.length > 0) {
      // Buscar una partida que tenga espacio disponible
      for (const game of existingGames) {
        const participantCount = game.game_participants?.[0]?.count || 0;
        if (participantCount < MAX_PLAYERS) {
          console.log(`📋 Partida existente encontrada con espacio: ${game.id} (${participantCount} jugadores)`);
          return game.id;
        }
      }
    }

    // Si no hay partidas disponibles, crear una nueva
    */
  }

  /**
   * Crea una nueva partida (método legacy, mantener para compatibilidad)
   */
  static async createGame(totalPlayers?: number): Promise<string> {
    // Construir objeto de inserción sin total_players si la columna no existe
    const insertData: any = {
      status: 'playing',
      started_at: new Date().toISOString(),
    };
    
    // Solo incluir total_players si se proporciona (y si la columna existe)
    // Por ahora, no lo incluimos para evitar errores
    // if (totalPlayers !== undefined) {
    //   insertData.total_players = totalPlayers;
    // }
    
    const { data, error } = await supabase
      .from('games')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating game:', error);
      throw new Error(`Failed to create game: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Actualiza el estado de una partida a "playing" cuando se inicia
   */
  static async startGame(gameId: string, totalPlayers: number): Promise<void> {
    const updateData: any = {
      status: 'playing',
      started_at: new Date().toISOString(),
    };
    
    // Solo incluir total_players si la columna existe
    // Por ahora, no lo incluimos para evitar errores
    // updateData.total_players = totalPlayers;
    
    const { error } = await supabase
      .from('games')
      .update(updateData)
      .eq('id', gameId);

    if (error) {
      console.error('Error starting game:', error);
      throw new Error(`Failed to start game: ${error.message}`);
    }
  }

  /**
   * Finaliza una partida y guarda los resultados
   */
  static async endGame(
    gameId: string,
    participants: Array<{
      userId: string;
      score: number;
      position: number; // 1 = ganador, 2 = segundo, etc.
    }>,
    winnerId: string | null,
    totalPlayers?: number
  ): Promise<void> {
    // Actualizar el estado de la partida
    const updateData: any = {
      status: 'finished',
      ended_at: new Date().toISOString(),
      winner_id: winnerId,
    };
    
    // Si se proporciona total_players, actualizarlo (incluye guests)
    if (totalPlayers !== undefined) {
      updateData.total_players = totalPlayers;
    }
    
    const { error: gameError } = await supabase
      .from('games')
      .update(updateData)
      .eq('id', gameId);

    if (gameError) {
      console.error('Error updating game:', gameError);
      throw new Error(`Failed to update game: ${gameError.message}`);
    }

    // Insertar participantes (el trigger actualizará las estadísticas automáticamente)
    const participantsData: GameParticipantInsert[] = participants.map((p) => ({
      game_id: gameId,
      user_id: p.userId,
      score: p.score,
      position: p.position,
      eliminated_at: p.position > 1 ? new Date().toISOString() : null, // Solo los perdedores tienen eliminated_at
    }));

    const { data: insertedParticipants, error: participantsError } = await supabase
      .from('game_participants')
      .insert(participantsData)
      .select();

    if (participantsError) {
      console.error('❌ Error inserting participants:', participantsError);
      // Si es un error de conflicto único, los participantes ya existen
      if (participantsError.code === '23505') {
        console.warn('⚠️  Participantes ya existen para esta partida (conflicto único). El trigger no se ejecutará.');
        console.warn('⚠️  Esto puede pasar si se reutiliza el mismo game_id. Verificar que se crean nuevas partidas.');
      }
      throw new Error(`Failed to insert participants: ${participantsError.message}`);
    }
    
    if (insertedParticipants && insertedParticipants.length > 0) {
      console.log(`✅ ${insertedParticipants.length} participantes insertados correctamente. El trigger debería ejecutarse ahora.`);
    } else {
      console.warn('⚠️  No se insertaron participantes (puede ser un conflicto único)');
    }

    console.log(`✅ Game ${gameId} ended and saved with ${participants.length} participants`);
  }

  /**
   * Obtiene las últimas partidas
   */
  static async getRecentGames(limit: number = 10): Promise<Game[]> {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching games:', error);
      throw new Error(`Failed to fetch games: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Obtiene los participantes de una partida
   */
  static async getGameParticipants(gameId: string): Promise<GameParticipant[]> {
    const { data, error } = await supabase
      .from('game_participants')
      .select('*')
      .eq('game_id', gameId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching participants:', error);
      throw new Error(`Failed to fetch participants: ${error.message}`);
    }

    return data || [];
  }
}

