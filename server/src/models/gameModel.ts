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
   * Crea una nueva partida
   */
  static async createGame(): Promise<string> {
    const { data, error } = await supabase
      .from('games')
      .insert({
        status: 'playing',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating game:', error);
      throw new Error(`Failed to create game: ${error.message}`);
    }

    return data.id;
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
    winnerId: string | null
  ): Promise<void> {
    // Actualizar el estado de la partida
    const { error: gameError } = await supabase
      .from('games')
      .update({
        status: 'finished',
        ended_at: new Date().toISOString(),
        winner_id: winnerId,
      })
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

    const { error: participantsError } = await supabase
      .from('game_participants')
      .insert(participantsData);

    if (participantsError) {
      console.error('Error inserting participants:', participantsError);
      throw new Error(`Failed to insert participants: ${participantsError.message}`);
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

