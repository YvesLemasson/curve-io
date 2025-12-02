// Modelo para interactuar con items premium desde el cliente
import { supabase } from "../config/supabase";

export interface PremiumItem {
  id: string;
  name: string;
  description: string | null;
  type: "color" | "trail" | "skin" | "effect";
  color_value: string;
  price_usd: number;
  price_loops: number; // Precio en Loops
  rarity: "common" | "rare" | "epic" | "legendary";
  is_limited: boolean;
  available_until: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserCurrency {
  user_id: string;
  loops: number; // Balance de Loops
  total_earned: number;
  total_spent: number;
  last_updated: string;
  created_at: string;
}

export interface CurrencyTransaction {
  id: string;
  user_id: string;
  amount: number; // Positivo = ganado, Negativo = gastado
  type: "earn" | "spend" | "purchase" | "reward" | "refund";
  source: string | null;
  description: string | null;
  related_item_id: string | null;
  created_at: string;
}

export interface UserInventoryItem {
  user_id: string;
  item_id: string;
  acquired_at: string;
  is_equipped: boolean;
  item?: PremiumItem;
}

export class PremiumModel {
  /**
   * Obtiene todos los items premium activos de un tipo específico
   */
  static async getPremiumItems(
    type: "color" | "trail" | "skin" | "effect" = "color"
  ): Promise<PremiumItem[]> {
    const { data, error } = await supabase
      .from("premium_items")
      .select("*")
      .eq("type", type)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("price_usd", { ascending: true });

    if (error) {
      console.error("Error fetching premium items:", error);
      throw new Error(`Failed to fetch premium items: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Obtiene el inventario de un usuario (items que posee)
   */
  static async getUserInventory(
    userId: string,
    type?: "color" | "trail" | "skin" | "effect"
  ): Promise<UserInventoryItem[]> {
    let query = supabase
      .from("user_inventory")
      .select(`
        *,
        item:premium_items(*)
      `)
      .eq("user_id", userId);

    if (type) {
      query = query.eq("item.type", type);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching user inventory:", error);
      throw new Error(`Failed to fetch user inventory: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      user_id: item.user_id,
      item_id: item.item_id,
      acquired_at: item.acquired_at,
      is_equipped: item.is_equipped,
      item: item.item as PremiumItem,
    }));
  }

  /**
   * Verifica si un usuario tiene un item específico
   */
  static async userHasItem(
    userId: string,
    itemId: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from("user_inventory")
      .select("item_id")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return false;
      }
      console.error("Error checking user item:", error);
      return false;
    }

    return !!data;
  }

  /**
   * Obtiene los colores disponibles para un usuario (gratuitos + premium que posee)
   */
  static async getAvailableColorsForUser(
    userId: string | null
  ): Promise<{ color: string; isPremium: boolean; itemId?: string; item?: PremiumItem }[]> {
    // Colores gratuitos base (solo 8 colores básicos - el resto se compra)
    const freeColors = [
      "#ff0000", // Rojo
      "#00ff00", // Verde
      "#0000ff", // Azul
      "#ffff00", // Amarillo
      "#ff00ff", // Magenta
      "#00ffff", // Cyan
      "#ff8000", // Naranja
      "#8000ff", // Morado
    ].map((color) => ({ color, isPremium: false }));

    // Si el usuario no está autenticado, solo devolver colores gratuitos
    if (!userId) {
      return freeColors;
    }

    // Obtener colores premium del usuario
    const inventory = await this.getUserInventory(userId, "color");
    const premiumColors = inventory
      .filter((item) => item.item && item.item.type === "color")
      .map((item) => ({
        color: item.item!.color_value,
        isPremium: true,
        itemId: item.item_id,
        item: item.item,
      }));

    return [...freeColors, ...premiumColors];
  }

  /**
   * Obtiene todos los colores premium disponibles (para la tienda)
   */
  static async getAllPremiumColors(): Promise<PremiumItem[]> {
    return this.getPremiumItems("color");
  }

  /**
   * Agrega un item al inventario del usuario (después de compra)
   */
  static async addItemToInventory(
    userId: string,
    itemId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("user_inventory")
      .insert({
        user_id: userId,
        item_id: itemId,
        is_equipped: false,
      });

    if (error) {
      // Si el item ya existe, no hacer nada (idempotente)
      if (error.code === "23505") {
        return;
      }
      console.error("Error adding item to inventory:", error);
      throw new Error(`Failed to add item to inventory: ${error.message}`);
    }
  }

  /**
   * Obtiene un item premium por ID
   */
  static async getPremiumItemById(itemId: string): Promise<PremiumItem | null> {
    const { data, error } = await supabase
      .from("premium_items")
      .select("*")
      .eq("id", itemId)
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching premium item:", error);
      throw new Error(`Failed to fetch premium item: ${error.message}`);
    }

    return data;
  }

  /**
   * Obtiene el balance de Loops de un usuario
   */
  static async getUserLoops(userId: string): Promise<number> {
    const { data, error } = await supabase
      .rpc("get_user_loops", { p_user_id: userId });

    if (error) {
      console.error("Error fetching user loops:", error);
      // Si la función no existe o hay error, intentar leer directamente
      const { data: currencyData, error: currencyError } = await supabase
        .from("user_currency")
        .select("loops")
        .eq("user_id", userId)
        .single();

      if (currencyError) {
        if (currencyError.code === "PGRST116") {
          // No existe registro, crear uno con balance 0
          return 0;
        }
        console.error("Error fetching currency:", currencyError);
        return 0;
      }

      return currencyData?.loops || 0;
    }

    return data || 0;
  }

  /**
   * Agrega Loops a un usuario (ganar moneda)
   */
  static async addLoops(
    userId: string,
    amount: number,
    type: "earn" | "reward" = "earn",
    source?: string,
    description?: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc("add_loops", {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_source: source || null,
      p_description: description || null,
    });

    if (error) {
      console.error("Error adding loops:", error);
      throw new Error(`Failed to add loops: ${error.message}`);
    }

    return data || 0;
  }

  /**
   * Gasta Loops de un usuario (comprar item)
   */
  static async spendLoops(
    userId: string,
    amount: number,
    itemId?: string,
    description?: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc("spend_loops", {
      p_user_id: userId,
      p_amount: amount,
      p_type: "purchase",
      p_source: "item_purchase",
      p_description: description || null,
      p_item_id: itemId || null,
    });

    if (error) {
      console.error("Error spending loops:", error);
      throw new Error(`Failed to spend loops: ${error.message}`);
    }

    return data || 0;
  }

  /**
   * Compra un item premium con Loops
   */
  static async purchaseItemWithLoops(
    userId: string,
    itemId: string
  ): Promise<void> {
    // Obtener el item
    const item = await this.getPremiumItemById(itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    // Verificar que el usuario tenga suficiente Loops
    const balance = await this.getUserLoops(userId);
    if (balance < item.price_loops) {
      throw new Error(`Insufficient loops. You have ${balance}, need ${item.price_loops}`);
    }

    // Verificar que no lo tenga ya
    const hasItem = await this.userHasItem(userId, itemId);
    if (hasItem) {
      throw new Error("You already own this item");
    }

    // Gastar moneda
    await this.spendLoops(userId, item.price_loops, itemId, `Purchased ${item.name}`);

    // Agregar al inventario
    await this.addItemToInventory(userId, itemId);

    // Registrar compra (opcional, para historial)
    await supabase.from("purchases").insert({
      user_id: userId,
      item_id: itemId,
      amount_paid: item.price_loops,
      currency: "LOOPS",
      status: "completed",
    });
  }

  /**
   * Obtiene el historial de transacciones de moneda
   */
  static async getCurrencyTransactions(
    userId: string,
    limit: number = 50
  ): Promise<CurrencyTransaction[]> {
    const { data, error } = await supabase
      .from("currency_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching transactions:", error);
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return data || [];
  }
}

