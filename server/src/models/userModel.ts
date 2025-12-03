// Modelo para interactuar con usuarios en Supabase
import { supabase } from "../config/supabase.js";
import type { Database } from "../config/supabase.js";
import { logger } from '../utils/logger.js';

type User = Database["public"]["Tables"]["users"]["Row"];
type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
type PlayerStats = Database["public"]["Tables"]["player_stats"]["Row"];

export interface LeaderboardEntry {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  total_games: number;
  total_wins: number;
  total_score: number;
  best_score: number;
  win_rate: number; // Calculado: total_wins / total_games
  elo_rating: number;
  peak_rating: number;
}

export class UserModel {
  /**
   * Crea o actualiza un usuario desde Google OAuth
   */
  static async createOrUpdateUser(
    authUserId: string,
    googleId: string,
    email: string,
    name: string,
    avatarUrl?: string
  ): Promise<User> {
    const { data, error } = await supabase
      .from("users")
      .upsert(
        {
          id: authUserId,
          google_id: googleId,
          email,
          name,
          avatar_url: avatarUrl,
        },
        {
          onConflict: "id",
        }
      )
      .select()
      .single();

    if (error) {
      logger.error("Error creating/updating user:", error);
      throw new Error(`Failed to create/update user: ${error.message}`);
    }

    return data;
  }

  /**
   * Obtiene un usuario por ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No encontrado
        return null;
      }
      logger.error("Error fetching user:", error);
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  /**
   * Obtiene las estadísticas de un jugador
   */
  static async getPlayerStats(userId: string): Promise<PlayerStats | null> {
    const { data, error } = await supabase
      .from("player_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No encontrado (jugador nuevo sin estadísticas)
        return null;
      }
      logger.error("Error fetching player stats:", error);
      throw new Error(`Failed to fetch player stats: ${error.message}`);
    }

    return data;
  }

  /**
   * Actualiza el nombre de visualización del usuario
   */
  static async updateDisplayName(
    userId: string,
    displayName: string
  ): Promise<User> {
    // Validar que el nombre no esté vacío y tenga longitud razonable
    if (!displayName || displayName.trim().length === 0) {
      throw new Error("El nombre no puede estar vacío");
    }
    if (displayName.trim().length > 50) {
      throw new Error("El nombre no puede tener más de 50 caracteres");
    }

    const { data, error } = await supabase
      .from("users")
      .update({ name: displayName.trim() })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      logger.error("Error updating display name:", error);
      throw new Error(`Failed to update display name: ${error.message}`);
    }

    return data;
  }

  /**
   * Asegura que el usuario existe en la BD y tiene un nombre guardado.
   * Si el usuario no existe o no tiene nombre, lo crea/actualiza.
   * Solo para usuarios autenticados (no guests).
   */
  static async ensureUserHasName(
    userId: string,
    displayName: string
  ): Promise<void> {
    // Validar que el nombre no esté vacío
    if (!displayName || displayName.trim().length === 0) {
      return;
    }

    // Validar longitud
    if (displayName.trim().length > 50) {
      displayName = displayName.trim().substring(0, 50);
    }

    try {
      // Verificar si el usuario existe
      const existingUser = await this.getUserById(userId);

      if (!existingUser) {
        // Usuario no existe, crear uno básico
        const { error: createError } = await supabase.from("users").insert({
          id: userId,
          name: displayName.trim(),
        });

        if (createError) {
          logger.error("Error creating user:", createError);
          // No lanzar error, solo loguear (no queremos bloquear el juego)
        }
      } else if (!existingUser.name) {
        // Usuario existe pero no tiene nombre, actualizarlo
        const { error: updateError } = await supabase
          .from("users")
          .update({ name: displayName.trim() })
          .eq("id", userId);

        if (updateError) {
          logger.error("Error updating user name:", updateError);
          // No lanzar error, solo loguear (no queremos bloquear el juego)
        }
      }
      // Si el usuario ya tiene nombre, no hacer nada (no sobrescribir)
    } catch (error) {
      logger.error("Error in ensureUserHasName:", error);
      // No lanzar error, solo loguear (no queremos bloquear el juego)
    }
  }

  /**
   * Obtiene el leaderboard (top jugadores)
   */
  static async getLeaderboard(
    limit: number = 10,
    sortBy:
      | "best_score"
      | "total_wins"
      | "total_score"
      | "elo_rating" = "elo_rating"
  ): Promise<LeaderboardEntry[]> {
    // Obtener estadísticas ordenadas
    const { data: stats, error: statsError } = await supabase
      .from("player_stats")
      .select("*")
      .order(sortBy, { ascending: false })
      .limit(limit);

    if (statsError) {
      logger.error("Error fetching leaderboard:", statsError);
      throw new Error(`Failed to fetch leaderboard: ${statsError.message}`);
    }

    if (!stats || stats.length === 0) {
      return [];
    }

    // Obtener información de usuarios
    const userIds = stats.map((s) => s.user_id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, avatar_url")
      .in("id", userIds);

    if (usersError) {
      logger.error("Error fetching users:", usersError);
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // Combinar datos
    const userMap = new Map(users?.map((u) => [u.id, u]) || []);
    const leaderboard: LeaderboardEntry[] = stats.map((stat) => {
      const user = userMap.get(stat.user_id);
      return {
        user_id: stat.user_id,
        name: user?.name || null,
        avatar_url: user?.avatar_url || null,
        total_games: stat.total_games,
        total_wins: stat.total_wins,
        total_score: stat.total_score,
        best_score: stat.best_score,
        win_rate: stat.total_games > 0 ? stat.total_wins / stat.total_games : 0,
        elo_rating: stat.elo_rating || 1000,
        peak_rating: stat.peak_rating || 1000,
      };
    });

    return leaderboard;
  }
}
