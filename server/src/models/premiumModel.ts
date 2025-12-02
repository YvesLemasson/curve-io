// Modelo para interactuar con items premium en Supabase
import { supabase } from "../config/supabase.js";

export interface PremiumItem {
  id: string;
  name: string;
  description: string | null;
  type: "color" | "trail" | "skin" | "effect";
  color_value: string;
  price_usd: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  is_limited: boolean;
  available_until: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserInventoryItem {
  user_id: string;
  item_id: string;
  acquired_at: string;
  is_equipped: boolean;
  item?: PremiumItem; // Item completo cuando se hace join
}

export interface Purchase {
  id: string;
  user_id: string;
  item_id: string;
  purchase_date: string;
  amount_paid: number;
  currency: string;
  payment_provider: string | null;
  payment_id: string | null;
  status: "pending" | "completed" | "failed" | "refunded";
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
   * Obtiene el inventario de un usuario (items que posee)
   */
  static async getUserInventory(
    userId: string,
    type?: "color" | "trail" | "skin" | "effect"
  ): Promise<UserInventoryItem[]> {
    let query = supabase
      .from("user_inventory")
      .select(
        `
        *,
        item:premium_items(*)
      `
      )
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
  static async userHasItem(userId: string, itemId: string): Promise<boolean> {
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
   * Agrega un item al inventario del usuario (después de compra)
   */
  static async addItemToInventory(
    userId: string,
    itemId: string
  ): Promise<void> {
    const { error } = await supabase.from("user_inventory").insert({
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
   * Registra una compra
   */
  static async recordPurchase(
    userId: string,
    itemId: string,
    amountPaid: number,
    currency: string = "USD",
    paymentProvider?: string,
    paymentId?: string,
    status: "pending" | "completed" | "failed" | "refunded" = "completed"
  ): Promise<Purchase> {
    const { data, error } = await supabase
      .from("purchases")
      .insert({
        user_id: userId,
        item_id: itemId,
        amount_paid: amountPaid,
        currency,
        payment_provider: paymentProvider || null,
        payment_id: paymentId || null,
        status,
      })
      .select()
      .single();

    if (error) {
      console.error("Error recording purchase:", error);
      throw new Error(`Failed to record purchase: ${error.message}`);
    }

    // Si la compra fue exitosa, agregar el item al inventario
    if (status === "completed") {
      await this.addItemToInventory(userId, itemId);
    }

    return data;
  }

  /**
   * Obtiene los colores disponibles para un usuario (gratuitos + premium que posee)
   */
  static async getAvailableColorsForUser(
    userId: string | null
  ): Promise<{ color: string; isPremium: boolean; itemId?: string }[]> {
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
      }));

    return [...freeColors, ...premiumColors];
  }

  /**
   * Obtiene el trail equipado de un usuario
   */
  static async getEquippedTrail(userId: string): Promise<PremiumItem | null> {
    const { data, error } = await supabase
      .from("user_inventory")
      .select(
        `
        *,
        item:premium_items(*)
      `
      )
      .eq("user_id", userId)
      .eq("is_equipped", true)
      .eq("item.type", "trail")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No se encontró ningún item equipado
        return null;
      }
      console.error("Error fetching equipped trail:", error);
      return null;
    }

    return (data?.item as PremiumItem) || null;
  }

  /**
   * Equipa un trail para un usuario (desequipa el anterior si existe)
   */
  static async equipTrail(userId: string, itemId: string): Promise<void> {
    // Verificar que el usuario posee el item
    const hasItem = await this.userHasItem(userId, itemId);
    if (!hasItem) {
      throw new Error("User does not own this trail");
    }

    // Verificar que es un trail
    const item = await this.getPremiumItemById(itemId);
    if (!item || item.type !== "trail") {
      throw new Error("Item is not a trail");
    }

    // Desequipar todos los trails del usuario
    await supabase
      .from("user_inventory")
      .update({ is_equipped: false })
      .eq("user_id", userId)
      .eq("item.type", "trail");

    // Equipar el nuevo trail
    const { error } = await supabase
      .from("user_inventory")
      .update({ is_equipped: true })
      .eq("user_id", userId)
      .eq("item_id", itemId);

    if (error) {
      console.error("Error equipping trail:", error);
      throw new Error(`Failed to equip trail: ${error.message}`);
    }
  }
}
