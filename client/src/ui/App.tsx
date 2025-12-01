// Main React application component
// Handles routing and general UI structure

import { useState, useEffect, useRef } from "react";
import { Game } from "../game/game";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../config/supabase";
import curvePhrasesData from "../data/curvePhrases.json";
import {
  t,
  setLanguage,
  getCurrentLanguage,
  onLanguageChange,
  type Language,
} from "../utils/i18n";
import "./App.css";

// Import Game here to avoid circular reference error
// import { NetworkClient } from '../network/client';

// Boost bar component
function BoostBar({
  charge,
  active,
  remaining,
}: {
  charge: number;
  active: boolean;
  remaining: number;
}) {
  const remainingSeconds = (remaining / 1000).toFixed(1);

  return (
    <div className="boost-bar-wrapper">
      <div className="boost-bar">
        <div
          className={`boost-fill ${active ? "boost-active" : ""}`}
          style={{ width: `${charge}%` }}
        />
      </div>
      {active && <div className="boost-timer">{remainingSeconds}s</div>}
    </div>
  );
}

// Helper function to convert hex to rgba
function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Game over modal component
function GameOverModal({
  gameState,
  onBackToMenu,
  onNextMatch,
  localPlayerId,
  preferredColor,
}: {
  gameState: {
    players: Array<{ id: string; name: string; color: string; alive: boolean }>;
    winnerId?: string;
    tick: number;
    currentRound?: number;
    totalRounds?: number;
    playerPoints?: Record<string, number>;
    roundResults?: Array<{
      round: number;
      deathOrder: Array<{ playerId: string; points: number }>;
    }>;
    playerRatingChanges?: Record<string, number>; // playerId -> rating_change
    playerEloRatings?: Record<string, number>; // playerId -> elo_rating (ELO actual antes del cambio)
  } | null;
  onBackToMenu: () => void;
  onNextMatch: () => void;
  localPlayerId?: string | null;
  preferredColor?: string;
}) {
  if (!gameState) return null;

  const winner = gameState.winnerId
    ? gameState.players.find((p) => p.id === gameState.winnerId)
    : null;
  const gameDuration = Math.floor(gameState.tick / 60); // Aproximadamente segundos (60 ticks por segundo)

  // Obtener el color del jugador local
  const localPlayer = localPlayerId
    ? gameState.players.find((p) => p.id === localPlayerId)
    : null;
  const localPlayerColor = localPlayer?.color || preferredColor || "#4caf50";

  // Ordenar jugadores por puntos (mayor a menor)
  const playersWithPoints = gameState.players
    .map((player) => ({
      ...player,
      points: gameState.playerPoints?.[player.id] || 0,
      ratingChange: gameState.playerRatingChanges?.[player.id],
      eloRating: gameState.playerEloRatings?.[player.id], // ELO actual antes del cambio
      isLocalPlayer: player.id === localPlayerId,
    }))
    .sort((a, b) => b.points - a.points);

  return (
    <div className="game-over-modal-overlay">
      <div className="game-over-modal">
        <h1 className="game-over-title">
          {winner ? t("gameOver.title") : t("gameOver.tie")}
        </h1>

        <div className="game-over-content">
          {/* Left column: Game information */}
          <div className="game-over-left">
            {winner ? (
              <div className="winner-section">
                <div className="winner-name" style={{ color: winner.color }}>
                  {winner.name}
                </div>
                <p className="winner-label">{t("gameOver.winnerLabel")}</p>
                {gameState.playerPoints && (
                  <p className="winner-points">
                    {gameState.playerPoints[winner.id] || 0}{" "}
                    {t("gameOver.totalPoints")}
                  </p>
                )}
              </div>
            ) : (
              <div className="tie-section">
                <p>{t("gameOver.allPlayersEliminated")}</p>
              </div>
            )}

            <div className="game-summary">
              <h2>{t("gameOver.gameSummary")}</h2>

              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">{t("gameOver.rounds")}:</span>
                  <span className="stat-value">
                    {gameState.totalRounds || 1} {t("gameOver.roundsPlural")}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t("gameOver.duration")}:</span>
                  <span className="stat-value">{gameDuration}s</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t("gameOver.players")}:</span>
                  <span className="stat-value">{gameState.players.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Player information with points */}
          <div className="game-over-right">
            <div className="players-summary">
              <h3>{t("gameOver.finalPoints")}</h3>
              <div className="players-list-summary">
                {playersWithPoints.map((player) => {
                  const isWinner = player.id === gameState.winnerId;
                  return (
                    <div
                      key={player.id}
                      className={`player-summary-item ${
                        isWinner ? "winner-item" : ""
                      }`}
                    >
                      <div
                        className="player-color-indicator"
                        style={{ backgroundColor: player.color }}
                      />
                      <span className="player-name-summary">{player.name}</span>
                      {player.eloRating !== undefined && (
                        <span
                          className="player-elo-rating"
                          style={
                            player.isLocalPlayer
                              ? { color: localPlayerColor }
                              : undefined
                          }
                        >
                          {Math.round(player.eloRating)} {t("gameOver.elo")}
                        </span>
                      )}
                      {player.ratingChange !== undefined && (
                        <span
                          className={`player-rating-change ${
                            player.ratingChange > 0
                              ? "rating-change-positive"
                              : player.ratingChange < 0
                              ? "rating-change-negative"
                              : ""
                          }`}
                        >
                          {player.ratingChange > 0 ? "+" : ""}
                          {player.ratingChange}
                        </span>
                      )}
                      <span className="player-points">
                        {player.points} {t("gameOver.points")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="game-over-actions">
          <button onClick={onBackToMenu} className="back-to-menu-button">
            {t("gameOver.backToMenu")}
          </button>
          <button
            onClick={onNextMatch}
            className="next-match-button"
            style={{
              backgroundColor: localPlayerColor,
              borderColor: localPlayerColor,
              boxShadow: `0 0 15px ${hexToRgba(
                localPlayerColor,
                0.3
              )}, 0 0 25px ${hexToRgba(localPlayerColor, 0.2)}`,
            }}
          >
            {t("gameOver.nextMatch")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Round summary modal component
function RoundSummaryModal({
  gameState,
  onNextRound,
  countdown,
  localPlayerId,
  preferredColor,
}: {
  gameState: {
    currentRound?: number;
    totalRounds?: number;
    playerPoints?: Record<string, number>;
    roundResults?: Array<{
      round: number;
      deathOrder: Array<{ playerId: string; points: number }>;
    }>;
    players: Array<{ id: string; name: string; color: string; alive: boolean }>;
  } | null;
  onNextRound: () => void;
  countdown?: number;
  localPlayerId?: string | null;
  preferredColor?: string;
}) {
  if (!gameState) return null;

  // Obtener el color del jugador local
  const localPlayer = localPlayerId
    ? gameState.players.find((p) => p.id === localPlayerId)
    : null;
  const localPlayerColor = localPlayer?.color || preferredColor || "#4caf50";

  // Obtener los resultados de la ronda actual
  const currentRound = gameState.currentRound || 1;
  const roundResult = gameState.roundResults?.find(
    (r) => r.round === currentRound
  );

  // Obtener jugadores con sus puntos de esta ronda
  const playersWithRoundPoints = gameState.players.map((player) => {
    const roundPoints =
      roundResult?.deathOrder.find((d) => d.playerId === player.id)?.points ||
      0;
    const totalPoints = gameState.playerPoints?.[player.id] || 0;
    return {
      ...player,
      roundPoints,
      totalPoints,
    };
  });

  // Ordenar por puntos de la ronda (mayor a menor)
  playersWithRoundPoints.sort((a, b) => b.roundPoints - a.roundPoints);

  return (
    <div className="game-over-modal-overlay">
      <div className="game-over-modal">
        <h1 className="game-over-title">
          {t("roundSummary.roundFinished", { round: currentRound.toString() })}
        </h1>

        <div className="game-over-content">
          {/* Left column: Round information */}
          <div className="game-over-left">
            <div className="round-summary">
              <h2>{t("roundSummary.roundSummary")}</h2>
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">{t("roundSummary.round")}:</span>
                  <span className="stat-value">
                    {currentRound}/{gameState.totalRounds || 5}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Player points for this round */}
          <div className="game-over-right">
            <div className="players-summary">
              <h3>{t("roundSummary.roundPoints")}</h3>
              <div className="players-list-summary">
                {playersWithRoundPoints.map((player, index) => {
                  return (
                    <div
                      key={player.id}
                      className={`player-summary-item ${
                        index === 0 ? "winner-item" : ""
                      }`}
                    >
                      <div
                        className="player-color-indicator"
                        style={{ backgroundColor: player.color }}
                      />
                      <span className="player-name-summary">{player.name}</span>
                      <span className="player-points">
                        +{player.roundPoints} {t("roundSummary.pts")}
                      </span>
                      <span className="player-total-points">
                        ({t("roundSummary.total")}: {player.totalPoints})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="round-summary-button-container">
          <button
            onClick={onNextRound}
            className="back-to-menu-button round-summary-button"
            disabled={countdown !== undefined && countdown >= 0}
            style={{
              backgroundColor: localPlayerColor,
              borderColor: localPlayerColor,
              boxShadow: `0 0 15px ${hexToRgba(
                localPlayerColor,
                0.3
              )}, 0 0 25px ${hexToRgba(localPlayerColor, 0.2)}`,
            }}
          >
            {countdown !== undefined && countdown > 0
              ? t("roundSummary.nextRoundCountdown", {
                  countdown: countdown.toString(),
                })
              : countdown === 0
              ? t("roundSummary.starting")
              : t("roundSummary.nextRound")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Language selector modal component
function LanguageSelectorModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [currentLang, setCurrentLang] = useState<Language>(
    getCurrentLanguage()
  );
  const [, forceUpdate] = useState({});

  // Subscribe to language changes
  useEffect(() => {
    const unsubscribe = onLanguageChange(() => {
      setCurrentLang(getCurrentLanguage());
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  const languages: Array<{ code: Language; name: string; flag: string }> = [
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "es", name: "Español", flag: "🇪🇸" },
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "it", name: "Italiano", flag: "🇮🇹" },
    { code: "pt", name: "Português", flag: "🇵🇹" },
  ];

  const handleLanguageSelect = async (lang: Language) => {
    await setLanguage(lang);
    setCurrentLang(lang);
  };

  if (!isOpen) return null;

  return (
    <div className="color-picker-modal-overlay" onClick={onClose}>
      <div className="color-picker-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("languageSelector.title")}</h2>
        <p
          style={{
            marginBottom: "20px",
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: "0.9rem",
          }}
        >
          {t("languageSelector.selectLanguage")}
        </p>
        <div className="language-selector-list">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`language-option ${
                currentLang === lang.code ? "selected" : ""
              }`}
              onClick={() => handleLanguageSelect(lang.code)}
            >
              <span className="language-flag">{lang.flag}</span>
              <span className="language-name">{lang.name}</span>
              {currentLang === lang.code && (
                <span className="check-mark">✓</span>
              )}
            </button>
          ))}
        </div>
        <div className="color-picker-actions">
          <button className="color-picker-cancel" onClick={onClose}>
            {t("languageSelector.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Color picker modal component
function ColorPickerModal({
  isOpen,
  currentColor,
  usedColors,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  currentColor: string;
  usedColors: Set<string>;
  onClose: () => void;
  onConfirm: (color: string) => void;
}) {
  const [selectedColor, setSelectedColor] = useState<string>(currentColor);

  // 16 colores predefinidos
  const availableColors = [
    "#ff0000", // Rojo
    "#00ff00", // Verde
    "#0000ff", // Azul
    "#ffff00", // Amarillo
    "#ff00ff", // Magenta
    "#00ffff", // Cyan
    "#ff8000", // Naranja
    "#8000ff", // Morado
    "#ff0080", // Rosa
    "#00ff80", // Verde claro
    "#0080ff", // Azul claro
    "#ff8080", // Rosa claro
    "#80ff80", // Verde menta
    "#8080ff", // Azul claro
    "#ffff80", // Amarillo claro
    "#ff80ff", // Rosa magenta
  ];

  if (!isOpen) return null;

  return (
    <div className="color-picker-modal-overlay" onClick={onClose}>
      <div className="color-picker-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("colorPicker.title")}</h2>
        <div className="color-picker-grid">
          {availableColors.map((color) => {
            const isUsed = usedColors.has(color) && color !== currentColor;
            const isSelected = selectedColor === color;
            return (
              <button
                key={color}
                className={`color-option ${isSelected ? "selected" : ""} ${
                  isUsed ? "used" : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => !isUsed && setSelectedColor(color)}
                disabled={isUsed}
                title={isUsed ? t("colorPicker.colorInUse") : color}
              >
                {isSelected && <span className="check-mark">✓</span>}
                {isUsed && <span className="used-mark">✗</span>}
              </button>
            );
          })}
        </div>
        <div className="color-picker-actions">
          <button className="color-picker-cancel" onClick={onClose}>
            {t("colorPicker.cancel")}
          </button>
          <button
            className="color-picker-confirm"
            onClick={() => {
              if (
                (selectedColor && !usedColors.has(selectedColor)) ||
                selectedColor === currentColor
              ) {
                onConfirm(selectedColor);
              }
            }}
            disabled={
              usedColors.has(selectedColor) && selectedColor !== currentColor
            }
          >
            {t("colorPicker.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Frases aleatorias sobre curves (cargadas desde JSON)
const curvePhrases = curvePhrasesData.curve_phrases;
const guestCurvePhrases = curvePhrasesData.guest_curve_phrases;

function App() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<
    "menu" | "game" | "lobby" | "leaderboard"
  >("menu");
  const [boostState, setBoostState] = useState<{
    active: boolean;
    charge: number;
    remaining: number;
  } | null>(null);
  const [roundInfo, setRoundInfo] = useState<{
    currentRound?: number;
    totalRounds?: number;
  } | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<
    Array<{
      id: string;
      name: string;
      color: string;
      points: number;
      alive: boolean;
    }>
  >([]);
  const [lobbyPlayers, setLobbyPlayers] = useState<
    Array<{ id: string; name: string; color: string; elo_rating?: number }>
  >([]);
  const [gameOverState, setGameOverState] = useState<{
    players: Array<{ id: string; name: string; color: string; alive: boolean }>;
    winnerId?: string;
    tick: number;
    currentRound?: number;
    totalRounds?: number;
    playerPoints?: Record<string, number>;
    roundResults?: Array<{
      round: number;
      deathOrder: Array<{ playerId: string; points: number }>;
    }>;
    playerRatingChanges?: Record<string, number>; // playerId -> rating_change
    playerEloRatings?: Record<string, number>; // playerId -> elo_rating (ELO actual antes del cambio)
  } | null>(null);
  const [roundSummaryState, setRoundSummaryState] = useState<{
    players: Array<{ id: string; name: string; color: string; alive: boolean }>;
    currentRound?: number;
    totalRounds?: number;
    playerPoints?: Record<string, number>;
    roundResults?: Array<{
      round: number;
      deathOrder: Array<{ playerId: string; points: number }>;
    }>;
    countdown?: number;
  } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [showLanguageSelector, setShowLanguageSelector] =
    useState<boolean>(false);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState<boolean>(false);
  const [touchLeft, setTouchLeft] = useState<boolean>(false);
  const [touchRight, setTouchRight] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showPlayerSidebar, setShowPlayerSidebar] = useState<boolean>(false);
  const [preferredColor, setPreferredColor] = useState<string>(() => {
    // Cargar color preferido desde localStorage
    const savedColor = localStorage.getItem("preferredColor");
    return savedColor || "#ff0000"; // Color por defecto: rojo
  });
  const [hasCustomColor, setHasCustomColor] = useState<boolean>(() => {
    // Verificar si el jugador ha cambiado su color manualmente
    return localStorage.getItem("hasCustomColor") === "true";
  });
  const [playerDisplayName, setPlayerDisplayName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameEditValue, setNameEditValue] = useState<string>("");
  const [randomCurvePhrase, setRandomCurvePhrase] = useState<string>("");
  const [playerStats, setPlayerStats] = useState<{
    elo_rating: number;
    peak_rating: number;
    rating_change: number;
    total_games: number;
    total_wins: number;
  } | null>(null);
  const [leaderboardCategory, setLeaderboardCategory] = useState<
    "all-time" | "month" | "day"
  >("day");
  const [leaderboardPlayers, setLeaderboardPlayers] = useState<
    Array<{
      user_id: string;
      name: string | null;
      elo_rating: number;
      elo_change?: number; // Para month/day
      total_games: number;
      total_wins: number;
      win_rate: number;
    }>
  >([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);
  const gameRef = useRef<Game | null>(null);
  const [, forceUpdate] = useState<{}>({});
  const [hudLeftPanelWidth, setHudLeftPanelWidth] = useState<number>(0);
  const [hudRightPanelWidth, setHudRightPanelWidth] = useState<number>(0);

  // Subscribe to language changes to force re-render
  useEffect(() => {
    const unsubscribe = onLanguageChange(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  // Calcular ancho de los paneles HUD basado en el espacio disponible
  useEffect(() => {
    const calculateHudWidth = () => {
      if (currentView !== "game" || !gameRef.current) {
        setHudLeftPanelWidth(0);
        setHudRightPanelWidth(0);
        return;
      }

      // Obtener la posición real del canvas usando getBoundingClientRect
      const canvasElement = document.getElementById("gameCanvas");
      if (!canvasElement) {
        setHudLeftPanelWidth(0);
        setHudRightPanelWidth(0);
        return;
      }

      const canvasRect = canvasElement.getBoundingClientRect();
      const windowWidth = window.innerWidth;

      // Calcular espacio disponible a la izquierda (desde el borde izquierdo hasta el canvas)
      const leftSpace = canvasRect.left;

      // Calcular espacio disponible a la derecha (desde el borde derecho del canvas hasta el borde derecho de la ventana)
      const rightSpace = windowWidth - canvasRect.right;

      // Logs para debugging del espacio morado
      console.log("=== Debug espacio morado ===");
      console.log("windowWidth:", windowWidth);
      console.log("canvasRect.right:", canvasRect.right);
      console.log("rightSpace calculado:", rightSpace);
      console.log("hudRightPanelWidth actual:", hudRightPanelWidth);
      console.log(
        "Diferencia:",
        windowWidth - (canvasRect.right + (hudRightPanelWidth || 0))
      );
      console.log("============================");

      // Asignar cada espacio a su respectivo panel
      setHudLeftPanelWidth(Math.max(0, leftSpace));
      setHudRightPanelWidth(Math.max(0, rightSpace));
    };

    calculateHudWidth();

    // Recalcular periódicamente y en resize para mantener sincronizado
    const interval = setInterval(calculateHudWidth, 100);
    window.addEventListener("resize", calculateHudWidth);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", calculateHudWidth);
    };
  }, [currentView]);

  // Seleccionar una frase aleatoria al cargar y reemplazar {player} con el nombre del jugador
  useEffect(() => {
    // Usar frases de Guest si el usuario no está logueado
    const phrasesToUse = user ? curvePhrases : guestCurvePhrases;
    const randomIndex = Math.floor(Math.random() * phrasesToUse.length);
    const selectedPhrase = phrasesToUse[randomIndex];

    // Si el usuario está logueado, reemplazar {player} con el nombre del jugador
    if (user) {
      const playerName =
        playerDisplayName ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        t("defaults.player");
      const phraseWithPlayer = selectedPhrase.replace(/{player}/g, playerName);
      setRandomCurvePhrase(phraseWithPlayer);
    } else {
      // Para guests, usar la frase directamente sin reemplazos
      setRandomCurvePhrase(selectedPhrase);
    }
  }, [playerDisplayName, user]);

  // Cerrar menú lateral con la tecla Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showPlayerSidebar) {
        setShowPlayerSidebar(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showPlayerSidebar]);

  // Detect if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isTouchDevice && isSmallScreen);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Cargar estadísticas del jugador desde BD
  useEffect(() => {
    const loadPlayerStats = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from("player_stats")
            .select(
              "elo_rating, peak_rating, rating_change, total_games, total_wins"
            )
            .eq("user_id", user.id)
            .single();

          if (error) {
            if (error.code === "PGRST116") {
              // Jugador nuevo sin estadísticas - usar valores por defecto
              setPlayerStats({
                elo_rating: 1000,
                peak_rating: 1000,
                rating_change: 0,
                total_games: 0,
                total_wins: 0,
              });
            } else {
              console.error("Error loading player stats:", error);
              setPlayerStats({
                elo_rating: 1000,
                peak_rating: 1000,
                rating_change: 0,
                total_games: 0,
                total_wins: 0,
              });
            }
          } else if (data) {
            setPlayerStats({
              elo_rating: data.elo_rating ?? 1000,
              peak_rating: data.peak_rating ?? 1000,
              rating_change: data.rating_change ?? 0,
              total_games: data.total_games ?? 0,
              total_wins: data.total_wins ?? 0,
            });
          } else {
            setPlayerStats({
              elo_rating: 1000,
              peak_rating: 1000,
              rating_change: 0,
              total_games: 0,
              total_wins: 0,
            });
          }
        } catch (err) {
          console.error("Error loading player stats:", err);
          setPlayerStats({
            elo_rating: 1000,
            peak_rating: 1000,
            rating_change: 0,
            total_games: 0,
            total_wins: 0,
          });
        }
      } else {
        setPlayerStats(null);
      }
    };

    // Cargar inmediatamente si el sidebar está abierto
    if (showPlayerSidebar && user?.id) {
      loadPlayerStats();
    } else if (user?.id) {
      // También cargar cuando hay usuario, aunque el sidebar no esté abierto
      loadPlayerStats();
    }

    // Recargar estadísticas cada 5 segundos cuando el sidebar está abierto
    if (showPlayerSidebar && user?.id) {
      const interval = setInterval(loadPlayerStats, 5000);
      return () => clearInterval(interval);
    }
  }, [user, showPlayerSidebar]);

  // Cargar nombre del jugador desde BD al iniciar sesión
  useEffect(() => {
    const loadPlayerName = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from("users")
            .select("name")
            .eq("id", user.id)
            .single();

          if (error && error.code !== "PGRST116") {
            console.error("Error loading player name:", error);
          }

          if (data?.name) {
            setPlayerDisplayName(data.name);
          } else {
            // Si no hay nombre en BD, usar el nombre por defecto
            const defaultName =
              user.user_metadata?.full_name ||
              user.email?.split("@")[0] ||
              t("defaults.player");
            setPlayerDisplayName(defaultName);
          }
        } catch (err) {
          console.error("Error loading player name:", err);
          // Fallback al nombre por defecto
          const defaultName =
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            t("defaults.player");
          setPlayerDisplayName(defaultName);
        }
      } else {
        // Usuario no autenticado - cargar desde localStorage
        const savedGuestName = localStorage.getItem("guestPlayerName");
        if (savedGuestName) {
          setPlayerDisplayName(savedGuestName);
        } else {
          setPlayerDisplayName(t("defaults.guestPlayer"));
        }
      }
    };

    loadPlayerName();
  }, [user]);

  // Handle beforeinstallprompt event for PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevenir el prompt automático
      e.preventDefault();
      // Guardar el evento para usarlo después
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Verificar si ya está instalado
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowInstallButton(false);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  // Function to install the PWA
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Mostrar el prompt de instalación
    deferredPrompt.prompt();

    // Esperar a que el usuario responda
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("Usuario aceptó la instalación");
    } else {
      console.log("Usuario rechazó la instalación");
    }

    // Limpiar el prompt
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  // Function to save display name
  const handleSaveDisplayName = async () => {
    const trimmedName = nameEditValue.trim();
    if (trimmedName.length === 0) {
      alert(t("errors.nameEmpty"));
      return;
    }

    if (trimmedName.length > 50) {
      alert(t("errors.nameTooLong"));
      return;
    }

    try {
      // Verificar que no estemos en una partida activa
      if (currentView === "game" && !gameOverState) {
        alert(t("errors.cannotChangeNameDuringGame"));
        setIsEditingName(false);
        return;
      }

      if (user?.id) {
        // Usuario autenticado - guardar en Supabase
        const { error } = await supabase
          .from("users")
          .update({ name: trimmedName })
          .eq("id", user.id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        setPlayerDisplayName(trimmedName);
        setIsEditingName(false);
      } else {
        // Usuario guest - guardar en localStorage
        localStorage.setItem("guestPlayerName", trimmedName);
        setPlayerDisplayName(trimmedName);
        setIsEditingName(false);
      }
    } catch (error: any) {
      console.error("Error saving display name:", error);
      alert(t("errors.errorSavingName", { error: error.message }));
    }
  };

  // Inicializar juego cuando se monta el componente
  useEffect(() => {
    if (!gameRef.current) {
      try {
        gameRef.current = new Game("gameCanvas");
      } catch (error) {
        console.error("Error al inicializar el juego:", error);
      }
    }

    // Cleanup al desmontar
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, []);

  // Actualizar estado del boost cada frame
  useEffect(() => {
    if (currentView !== "game" || !gameRef.current) return;

    const interval = setInterval(() => {
      if (gameRef.current) {
        const state = gameRef.current.getLocalPlayerBoostState();
        setBoostState(state);

        // Actualizar información de ronda
        const gameState = gameRef.current.getGameState();
        setRoundInfo({
          currentRound: gameState.currentRound,
          totalRounds: gameState.totalRounds,
        });

        // Actualizar clasificación
        const players = gameRef.current.getPlayers();
        const playersWithPoints = players
          .map((player) => ({
            id: player.id,
            name: player.name,
            color: player.color,
            points: gameState.playerPoints?.[player.id] || 0,
            alive: player.alive,
          }))
          .sort((a, b) => b.points - a.points);
        setLeaderboardData(playersWithPoints);
      }
    }, 16); // ~60 FPS

    return () => clearInterval(interval);
  }, [currentView]);

  // Monitorear el estado del juego para detectar cuando termina una ronda o el juego
  useEffect(() => {
    if (currentView !== "game" || !gameRef.current) return;

    // Variable para evitar mostrar el modal múltiples veces
    let gameOverShown = false;

    const interval = setInterval(() => {
      if (gameRef.current) {
        const gameState = gameRef.current.getGameState();

        // Detectar cuando termina una ronda (pero no el juego completo)
        if (gameState.gameStatus === "round-ended" && !roundSummaryState) {
          const players = gameRef.current.getPlayers();
          setRoundSummaryState({
            players: players.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              alive: p.alive,
            })),
            currentRound: gameState.currentRound,
            totalRounds: gameState.totalRounds,
            playerPoints: gameState.playerPoints,
            roundResults: gameState.roundResults,
            countdown: gameState.nextRoundCountdown,
          });

          // IMPORTANTE: Desactivar input cuando se muestra el modal
          const inputManager = gameRef.current.getInputManager();
          inputManager.setGameActive(false);
        }

        // Actualizar cuenta atrás si ya está mostrando el modal
        if (gameState.gameStatus === "round-ended" && roundSummaryState) {
          setRoundSummaryState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              countdown: gameState.nextRoundCountdown,
            };
          });
        }

        // Detectar cuando el juego termina completamente
        if (
          (gameState.gameStatus === "finished" ||
            gameState.gameStatus === "ended") &&
          !gameOverShown
        ) {
          // El juego terminó, mostrar modal
          gameOverShown = true;
          const players = gameRef.current.getPlayers();
          setGameOverState({
            players: players.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              alive: p.alive,
            })),
            winnerId: gameState.winnerId,
            tick: gameState.tick,
            currentRound: gameState.currentRound,
            totalRounds: gameState.totalRounds,
            playerPoints: gameState.playerPoints,
            roundResults: gameState.roundResults,
          });

          // Cargar cambios de ELO de los jugadores
          const loadRatingChanges = async () => {
            try {
              // Esperar un momento para que se guarden los datos en la BD y se ejecute el trigger
              // El trigger se ejecuta inmediatamente después de insertar en game_participants,
              // pero puede haber un pequeño delay en la replicación de Supabase
              await new Promise((resolve) => setTimeout(resolve, 500));

              // Obtener el game_id más reciente del usuario actual que haya terminado recientemente
              // (en los últimos 30 segundos para asegurar que es la partida que acaba de terminar)
              if (user?.id) {
                const thirtySecondsAgo = new Date(
                  Date.now() - 30000
                ).toISOString();

                const { data: recentGame } = await supabase
                  .from("game_participants")
                  .select("game_id")
                  .eq("user_id", user.id)
                  .gte("created_at", thirtySecondsAgo) // Solo partidas de los últimos 30 segundos
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle(); // Usar maybeSingle() en lugar de single() para evitar error si no hay resultados

                console.log("[ELO] Recent game (last 30s):", recentGame);

                // Si no hay partida reciente, intentar con la más reciente sin filtro de tiempo
                let gameIdToUse = recentGame?.game_id;
                if (!gameIdToUse) {
                  const { data: anyRecentGame } = await supabase
                    .from("game_participants")
                    .select("game_id")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle(); // Usar maybeSingle() en lugar de single() para evitar error si no hay resultados

                  gameIdToUse = anyRecentGame?.game_id;
                  console.log(
                    "[ELO] Fallback to any recent game:",
                    anyRecentGame
                  );
                }

                if (recentGame?.game_id) {
                  // Verificar que los participantes existan
                  const { data: participantsData, error: participantsError } =
                    await supabase
                      .from("game_participants")
                      .select("user_id")
                      .eq("game_id", gameIdToUse);

                  console.log(
                    "[ELO] Participants data:",
                    participantsData,
                    "Error:",
                    participantsError
                  );

                  // Obtener todos los cambios de ELO de esta partida (con reintentos)
                  let ratingChanges: any[] = [];
                  let attempts = 0;
                  const maxAttempts = 5;

                  while (ratingChanges.length === 0 && attempts < maxAttempts) {
                    const { data, error: ratingError } = await supabase
                      .from("rating_history")
                      .select("user_id, rating_change")
                      .eq("game_id", gameIdToUse);

                    ratingChanges = data || [];
                    console.log(
                      `[ELO] Attempt ${attempts + 1}: Rating changes:`,
                      ratingChanges,
                      "Error:",
                      ratingError
                    );

                    if (
                      ratingChanges.length === 0 &&
                      attempts < maxAttempts - 1
                    ) {
                      // Esperar un poco antes de reintentar (reducido para respuesta más rápida)
                      await new Promise((resolve) => setTimeout(resolve, 300));
                    }
                    attempts++;
                  }

                  // Obtener nombres de usuarios
                  const userIds = participantsData?.map((p) => p.user_id) || [];
                  const { data: usersData } = await supabase
                    .from("users")
                    .select("id, name")
                    .in("id", userIds);

                  const participants =
                    participantsData?.map((p) => ({
                      user_id: p.user_id,
                      users: usersData?.find((u) => u.id === p.user_id),
                    })) || [];

                  console.log("[ELO] Participants with names:", participants);

                  if (
                    ratingChanges &&
                    ratingChanges.length > 0 &&
                    participants
                  ) {
                    // Crear mapa de user_id -> rating_change
                    const ratingChangeMap: Record<string, number> = {};
                    ratingChanges.forEach((rc) => {
                      ratingChangeMap[rc.user_id] = rc.rating_change;
                    });

                    // Crear mapa de nombre -> user_id desde participantes
                    const nameToUserIdMap: Record<string, string> = {};
                    participants.forEach((p: any) => {
                      const userName = p.users?.name;
                      if (userName && p.user_id) {
                        nameToUserIdMap[userName] = p.user_id;
                      }
                    });

                    console.log("[ELO] Name to user_id map:", nameToUserIdMap);
                    console.log("[ELO] Rating change map:", ratingChangeMap);

                    // Mapear player.id a rating_change usando el nombre
                    const playerRatingChanges: Record<string, number> = {};
                    players.forEach((player) => {
                      const userId = nameToUserIdMap[player.name];
                      if (userId && ratingChangeMap[userId] !== undefined) {
                        playerRatingChanges[player.id] =
                          ratingChangeMap[userId];
                        console.log(
                          `[ELO] Mapped ${player.name} (${player.id}) -> ${ratingChangeMap[userId]}`
                        );
                      }
                    });

                    // Cargar ELOs actuales de los jugadores (antes del cambio)
                    const playerEloRatings: Record<string, number> = {};
                    const userIdsForElo = Object.values(nameToUserIdMap);
                    if (userIdsForElo.length > 0) {
                      const { data: eloData } = await supabase
                        .from("player_stats")
                        .select("user_id, elo_rating")
                        .in("user_id", userIdsForElo);

                      if (eloData) {
                        // Crear mapa de user_id -> elo_rating
                        const eloMap: Record<string, number> = {};
                        eloData.forEach((stat) => {
                          // El ELO actual es el ELO después del cambio menos el cambio
                          const userId = stat.user_id;
                          const ratingChange = ratingChangeMap[userId] || 0;
                          const currentElo =
                            (stat.elo_rating || 1000) - ratingChange;
                          eloMap[userId] = currentElo;
                        });

                        // Mapear player.id a elo_rating usando el nombre
                        players.forEach((player) => {
                          const userId = nameToUserIdMap[player.name];
                          if (userId && eloMap[userId] !== undefined) {
                            playerEloRatings[player.id] = eloMap[userId];
                            console.log(
                              `[ELO] Mapped ${player.name} (${player.id}) -> ELO ${eloMap[userId]}`
                            );
                          }
                        });
                      }
                    }

                    console.log(
                      "[ELO] Final player rating changes:",
                      playerRatingChanges
                    );
                    console.log(
                      "[ELO] Final player ELO ratings:",
                      playerEloRatings
                    );

                    setGameOverState((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        playerRatingChanges,
                        playerEloRatings,
                      };
                    });
                  } else {
                    console.warn(
                      "[ELO] No rating changes found after",
                      maxAttempts,
                      "attempts. Participants:",
                      participantsData?.length
                    );
                  }
                } else {
                  console.log("[ELO] No recent game found");
                }
              } else {
                console.log("[ELO] No user ID");
              }
            } catch (error) {
              console.error("[ELO] Error loading rating changes:", error);
            }
          };

          // Cargar cambios de ELO en segundo plano
          loadRatingChanges();

          // IMPORTANTE: Desactivar input cuando se muestra el modal
          const inputManager = gameRef.current.getInputManager();
          inputManager.setGameActive(false);

          // Limpiar estado de resumen de ronda si existe
          setRoundSummaryState(null);
        }

        // Nota: El cierre del modal cuando vuelve a 'playing' se maneja en un efecto separado
      }
    }, 50); // Verificar cada 50ms para detectar más rápido

    return () => clearInterval(interval);
  }, [currentView, roundSummaryState]);

  // Desactivar input cuando hay un modal abierto
  useEffect(() => {
    if (gameRef.current && (gameOverState || roundSummaryState)) {
      const inputManager = gameRef.current.getInputManager();
      inputManager.setGameActive(false);
    }
  }, [gameOverState, roundSummaryState]);

  // Efecto separado para cerrar el modal cuando el juego vuelve a 'playing'
  useEffect(() => {
    if (currentView !== "game" || !gameRef.current || !roundSummaryState)
      return;

    const checkInterval = setInterval(() => {
      if (gameRef.current) {
        const gameState = gameRef.current.getGameState();

        // Si el juego vuelve a 'playing', cerrar el modal
        if (gameState.gameStatus === "playing") {
          setRoundSummaryState(null);

          // Reactivar input cuando se cierra el modal
          const inputManager = gameRef.current.getInputManager();
          inputManager.setGameActive(true);
        }
      }
    }, 50);

    return () => clearInterval(checkInterval);
  }, [currentView, roundSummaryState]);

  // Función para manejar el botón "Next Round"
  const handleNextRound = () => {
    if (gameRef.current && gameRef.current.isUsingNetwork()) {
      // Verificar que el estado sea 'round-ended' antes de enviar
      const gameState = gameRef.current.getGameState();
      if (gameState.gameStatus !== "round-ended") {
        return;
      }

      // Verificar que no haya una cuenta atrás en curso
      if (
        gameState.nextRoundCountdown !== undefined &&
        gameState.nextRoundCountdown > 0
      ) {
        return;
      }

      const networkClient = gameRef.current.getNetworkClient();
      if (networkClient) {
        networkClient.requestNextRound();
      }
    }
  };

  // Function to connect to server and show lobby
  const handleConnectToServer = () => {
    // Si ya existe un juego con red, limpiarlo primero
    if (gameRef.current) {
      if (gameRef.current.isUsingNetwork()) {
        gameRef.current.destroy();
      } else {
        gameRef.current.destroy();
      }
    }

    // Crear nuevo juego con red
    try {
      gameRef.current = new Game("gameCanvas", true);

      // Configurar callback para estado de toques (feedback visual)
      const inputManager = gameRef.current.getInputManager();
      inputManager.onTouchStateChange((left, right) => {
        setTouchLeft(left);
        setTouchRight(right);
      });
    } catch (error) {
      console.error("Error al inicializar el juego:", error);
      return;
    }

    const networkClient = gameRef.current.getNetworkClient();
    if (!networkClient) {
      console.error("No se pudo obtener el cliente de red");
      return;
    }

    // IMPORTANTE: Configurar callbacks ANTES de conectar para que estén listos cuando lleguen los eventos
    networkClient.onLobbyPlayers((data) => {
      setLobbyPlayers(data.players);
      // Actualizar color preferido si el jugador local tiene un color asignado
      const localPlayer = data.players.find((p) => p.id === localPlayerId);
      if (localPlayer && localPlayer.color !== "#ffffff") {
        const currentPreferred =
          localStorage.getItem("preferredColor") || "#ff0000";
        if (localPlayer.color !== currentPreferred) {
          setPreferredColor(localPlayer.color);
          localStorage.setItem("preferredColor", localPlayer.color);
        }
      }
    });

    networkClient.onPlayerJoined((data) => {
      setLocalPlayerId(data.playerId);
      // También actualizar el localPlayerId en la instancia de Game
      // para que el juego pueda enviar inputs correctamente
      if (gameRef.current) {
        gameRef.current.setLocalPlayerId(data.playerId);
      }
    });

    networkClient.onGameStart(() => {
      // When the server starts the game, start the local game too
      // IMPORTANT: In network mode we DON'T call init() because players
      // se crean desde el estado del servidor en syncFromServer()
      if (gameRef.current) {
        // Limpiar cualquier jugador local previo
        gameRef.current.clearPlayers();
        // Only start the game loop, players will come from the server
        gameRef.current.start();
        setCurrentView("game");
      }
    });

    networkClient.onError((error) => {
      console.error("[App] Error de red:", error);
      // Solo mostrar alert si es un error crítico, no para errores menores
      if (
        error.includes("No se pudo conectar") ||
        error.includes("servidor no está")
      ) {
        alert(t("errors.connectionError", { error }));
      } else {
        // Para otros errores, solo loggear
        console.warn("[App] Error de red (no crítico):", error);
      }
    });

    networkClient.onConnect(() => {
      // Enviar user_id si el usuario está autenticado
      if (user?.id) {
        networkClient.sendAuthUser(user.id);
      }

      // Cuando se conecta, unirse al lobby
      setTimeout(() => {
        if (gameRef.current) {
          // Usar el nombre guardado (BD para autenticados, localStorage para guests)
          const playerName =
            playerDisplayName ||
            (user
              ? user.user_metadata?.full_name ||
                user.email?.split("@")[0] ||
                "Player"
              : localStorage.getItem("guestPlayerName") ||
                t("defaults.guestPlayer"));
          // Obtener color preferido desde localStorage
          const savedPreferredColor =
            localStorage.getItem("preferredColor") || preferredColor;
          gameRef.current.joinLobby(playerName, savedPreferredColor);
        } else {
          console.error("gameRef.current es null, no se puede unir al lobby");
        }
      }, 100);
    });

    // Cambiar a vista de lobby primero
    setCurrentView("lobby");

    // Connect to server
    networkClient.connect();
  };

  // Function to start local game (deshabilitada temporalmente)
  // const handleStartLocalGame = () => {
  //   if (gameRef.current) {
  //     // Si ya existe, destruirlo y crear uno nuevo
  //     if (gameRef.current.isUsingNetwork()) {
  //       gameRef.current.destroy();
  //       gameRef.current = new Game("gameCanvas", false);
  //     }

  //     gameRef.current.init(4); // 4 jugadores
  //     gameRef.current.start();
  //     setCurrentView("game");
  //   }
  // };

  // Function to load leaderboard
  const loadLeaderboard = async (
    category: "all-time" | "month" | "day" = leaderboardCategory
  ) => {
    setLoadingLeaderboard(true);
    try {
      let stats: any[] = [];
      let statsError: any = null;

      if (category === "all-time") {
        // All-time: ordenado por ELO actual
        const result = await supabase
          .from("player_stats")
          .select(
            "user_id, elo_rating, total_games, total_wins, users!inner(name)"
          )
          .order("elo_rating", { ascending: false })
          .limit(100);
        stats = result.data || [];
        statsError = result.error;
      } else {
        // Month o Day: ordenado por cambio de ELO
        // Obtener stats y luego calcular el cambio desde el inicio del período
        const statsResult = await supabase
          .from("player_stats")
          .select(
            "user_id, elo_rating, total_games, total_wins, users!inner(name)"
          )
          .limit(1000); // Obtener más para filtrar después

        if (statsResult.error) {
          statsError = statsResult.error;
        } else {
          const userIds = (statsResult.data || []).map((s: any) => s.user_id);

          // Obtener cambios de rating desde el inicio del período (UTC)
          const now = new Date();
          let periodDate: string;
          if (category === "day") {
            // Inicio del día actual en UTC
            const startOfDay = new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                0,
                0,
                0
              )
            );
            periodDate = startOfDay.toISOString();
          } else {
            // Inicio del mes actual en UTC
            const startOfMonth = new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)
            );
            periodDate = startOfMonth.toISOString();
          }

          const { data: ratingChanges, error: changesError } = await supabase
            .from("rating_history")
            .select("user_id, rating_change")
            .in("user_id", userIds)
            .gte("created_at", periodDate);

          if (changesError) {
            console.error("Error fetching rating changes:", changesError);
          }

          // Agrupar cambios por usuario
          const changesMap = new Map<string, number>();
          (ratingChanges || []).forEach((change: any) => {
            const current = changesMap.get(change.user_id) || 0;
            changesMap.set(
              change.user_id,
              current + (change.rating_change || 0)
            );
          });

          // Combinar stats con cambios y filtrar solo los que tienen actividad
          stats = (statsResult.data || [])
            .map((stat: any) => {
              const eloChange = changesMap.get(stat.user_id) || 0;
              return {
                ...stat,
                elo_change: eloChange,
              };
            })
            .filter((stat: any) => stat.elo_change !== 0) // Solo mostrar activos en month/day
            .sort((a: any, b: any) => {
              return (b.elo_change || 0) - (a.elo_change || 0);
            })
            .slice(0, 100);
        }
      }

      if (statsError) {
        console.error("Error fetching leaderboard:", statsError);
        setLeaderboardPlayers([]);
        return;
      }

      if (!stats || stats.length === 0) {
        setLeaderboardPlayers([]);
        return;
      }

      // Los datos ya vienen con el nombre del usuario en users.name
      const leaderboard = stats.map((stat: any) => {
        // En Supabase, cuando haces JOIN con foreign key, el resultado viene como un objeto anidado
        // Para relaciones uno-a-uno, viene como un objeto, no como array
        const userName = stat.users?.name || null;

        return {
          user_id: stat.user_id,
          name: userName || t("defaults.unknownPlayer"),
          elo_rating: stat.elo_rating || 1000,
          elo_change: stat.elo_change,
          total_games: stat.total_games || 0,
          total_wins: stat.total_wins || 0,
          win_rate:
            stat.total_games > 0 ? stat.total_wins / stat.total_games : 0,
        };
      });

      setLeaderboardPlayers(leaderboard);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      setLeaderboardPlayers([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Función para calcular tiempo restante hasta el final del período (UTC)
  const getTimeRemaining = (period: "day" | "month"): string => {
    const now = new Date();
    const nowUTC = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      )
    );

    let endTime: Date;
    if (period === "day") {
      // Fin del día actual en UTC (próxima medianoche UTC)
      endTime = new Date(
        Date.UTC(
          nowUTC.getUTCFullYear(),
          nowUTC.getUTCMonth(),
          nowUTC.getUTCDate() + 1,
          0,
          0,
          0
        )
      );
    } else {
      // Fin del mes actual en UTC (primer día del próximo mes)
      endTime = new Date(
        Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth() + 1, 1, 0, 0, 0)
      );
    }

    const diff = endTime.getTime() - nowUTC.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (period === "day") {
      return `${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }
  };

  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Actualizar countdown
  useEffect(() => {
    if (currentView === "leaderboard" && leaderboardCategory !== "all-time") {
      const updateCountdown = () => {
        setTimeRemaining(getTimeRemaining(leaderboardCategory));
      };

      updateCountdown();
      const interval = setInterval(
        updateCountdown,
        leaderboardCategory === "day" ? 60000 : 3600000
      ); // Cada minuto para day, cada hora para month

      return () => clearInterval(interval);
    } else {
      setTimeRemaining("");
    }
  }, [currentView, leaderboardCategory]);

  // Cargar leaderboard cuando se abre la vista o cambia la categoría
  useEffect(() => {
    if (currentView === "leaderboard") {
      loadLeaderboard(leaderboardCategory);
    }
  }, [currentView, leaderboardCategory]);

  // Function to request game start from lobby
  const handleStartGameFromLobby = () => {
    const networkClient = gameRef.current?.getNetworkClient();
    if (networkClient) {
      networkClient.requestStartGame();
    }
  };

  // Function to go back to menu from game over modal
  const handleBackToMenuFromGameOver = () => {
    if (gameRef.current) {
      gameRef.current.stop();
      if (gameRef.current.isUsingNetwork()) {
        const networkClient = gameRef.current.getNetworkClient();
        if (networkClient) {
          networkClient.disconnect();
        }
        gameRef.current.destroy();
        gameRef.current = new Game("gameCanvas");
      }
    }
    setGameOverState(null);
    setCurrentView("menu");
    setLobbyPlayers([]);
    // Limpiar estado de toques
    setTouchLeft(false);
    setTouchRight(false);
  };

  // Function to go to next match (matchmaking) from game over modal
  const handleNextMatchFromGameOver = () => {
    if (gameRef.current) {
      gameRef.current.stop();
      if (gameRef.current.isUsingNetwork()) {
        const networkClient = gameRef.current.getNetworkClient();
        if (networkClient) {
          networkClient.disconnect();
        }
        gameRef.current.destroy();
      }
    }
    setGameOverState(null);
    setLobbyPlayers([]);
    setLocalPlayerId(null);
    // Limpiar estado de toques
    setTouchLeft(false);
    setTouchRight(false);
    // Llamar a handleConnectToServer para ir directamente al matchmaking
    handleConnectToServer();
  };

  // Obtener el color del jugador local para el feedback visual
  const getLocalPlayerColor = (): string => {
    if (gameRef.current) {
      const players = gameRef.current.getPlayers();
      const localPlayer = players.find(
        (p) =>
          p.id === localPlayerId ||
          (!gameRef.current?.isUsingNetwork() && players.indexOf(p) === 0)
      );
      return localPlayer?.color || "#ffffff";
    }
    return "#ffffff";
  };

  // Convertir color hex a rgba con opacidad para el gradiente
  const getLocalPlayerColorWithOpacity = (opacity: number = 0.3): string => {
    const color = getLocalPlayerColor();
    // Si es un color hex (#rrggbb), convertirlo a rgba
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // Si ya es rgba o rgb, mantenerlo
    return color;
  };

  return (
    <div className="app">
      {/* Game canvas */}
      <canvas
        id="gameCanvas"
        style={{
          zIndex: 1,
          display: "block",
        }}
      />

      {/* Touch visual feedback - only in game mode */}
      {currentView === "game" && !gameOverState && (
        <>
          {/* Left overlay */}
          <div
            className="touch-feedback touch-feedback-left"
            style={
              {
                opacity: touchLeft ? 1 : 0,
                "--touch-feedback-color": touchLeft
                  ? getLocalPlayerColorWithOpacity(0.8)
                  : "transparent",
              } as React.CSSProperties
            }
          />
          {/* Right overlay */}
          <div
            className="touch-feedback touch-feedback-right"
            style={
              {
                opacity: touchRight ? 1 : 0,
                "--touch-feedback-color": touchRight
                  ? getLocalPlayerColorWithOpacity(0.8)
                  : "transparent",
              } as React.CSSProperties
            }
          />
        </>
      )}

      {/* UI Overlay - React handles menus, HUD, etc. */}
      <div
        className="ui-overlay"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 10,
          pointerEvents:
            currentView === "game" && !gameOverState ? "none" : "auto",
        }}
      >
        {currentView === "menu" && (
          <div className="main-menu">
            {/* Language and Sign Out buttons - top right */}
            <div className="menu-top-buttons">
              <button
                onClick={() => setShowLanguageSelector(true)}
                className="menu-language-button"
                aria-label={t("menu.changeLanguage")}
                title={t("menu.changeLanguage")}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </button>
              {user && (
                <button
                  onClick={signOut}
                  className="menu-signout-button"
                  aria-label={t("menu.signOut")}
                  title={t("menu.signOut")}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </button>
              )}
            </div>
            {/* Left side: Title and Welcome */}
            <div className="main-menu-left">
              <div className="main-menu-left-top">
                <div
                  className="logo-image-wrapper"
                  style={
                    {
                      "--preferred-color": hasCustomColor
                        ? preferredColor
                        : "#ffffff",
                    } as React.CSSProperties
                  }
                >
                  <img
                    src="/curveIO.png"
                    alt="curve.io"
                    className="logo-image"
                  />
                </div>
                {loading ? (
                  <p className="welcome-text">{t("menu.loading")}</p>
                ) : (
                  <p className="welcome-text">
                    {randomCurvePhrase || t("menu.loading")}
                  </p>
                )}
              </div>

              {/* Bottom: Controls info */}
              <div className="controls-info">
                <h3>{t("menu.controls")}</h3>
                {isMobile ? (
                  <>
                    <p>{t("menu.mobile.tapLeft")}</p>
                    <p>{t("menu.mobile.tapRight")}</p>
                    <p>{t("menu.mobile.tapBoth")}</p>
                  </>
                ) : (
                  <>
                    <p>{t("menu.desktop.turnLeft")}</p>
                    <p>{t("menu.desktop.turnRight")}</p>
                    <p>{t("menu.desktop.activateBoost")}</p>
                  </>
                )}
              </div>
            </div>

            {/* Right side: Menu options */}
            <div className="main-menu-right">
              {/* Player Menu Button */}
              <button
                className="player-menu-button"
                onClick={() => setShowPlayerSidebar(true)}
                aria-label={t("menu.openPlayerMenu")}
                title={t("menu.playerMenu")}
              >
                <div
                  className="player-menu-button-color"
                  style={{ backgroundColor: preferredColor }}
                />
                <span className="player-menu-button-icon">☰</span>
              </button>

              <div className="main-menu-right-top">
                <button
                  onClick={handleConnectToServer}
                  className="menu-option"
                  style={{
                    textDecorationColor: preferredColor,
                  }}
                  title={
                    !user
                      ? t("menu.playAsGuestTooltip")
                      : t("menu.playOnlineTooltip")
                  }
                >
                  {!user ? t("menu.playAsGuest") : t("menu.playOnline")}
                </button>
                {/* Local Game deshabilitado temporalmente */}
                {/* <button onClick={handleStartLocalGame} className="menu-option">
                  Local Game
                </button> */}
                <button
                  onClick={() => setCurrentView("leaderboard")}
                  className="menu-option"
                  style={{
                    textDecorationColor: preferredColor,
                  }}
                >
                  {t("menu.leaderboard")}
                </button>
                {!user && (
                  <button
                    onClick={signInWithGoogle}
                    className="menu-option"
                    style={{
                      textDecorationColor: preferredColor,
                    }}
                  >
                    {t("menu.signIn")}
                  </button>
                )}
              </div>

              {showInstallButton && (
                <button
                  onClick={handleInstallClick}
                  className="install-button"
                  title={t("menu.installTooltip")}
                >
                  {t("menu.install")}
                </button>
              )}
            </div>
          </div>
        )}

        {currentView === "leaderboard" && (
          <div className="leaderboard-view">
            <button
              onClick={() => setCurrentView("menu")}
              className="leaderboard-close-button"
              aria-label={t("leaderboard.closeTooltip")}
              title={t("leaderboard.close")}
            >
              ✕
            </button>
            <div className="leaderboard-view-content">
              <div className="leaderboard-layout">
                {/* Columna izquierda: Selectores de tiempo */}
                <div className="leaderboard-sidebar">
                  <div className="leaderboard-tabs-vertical">
                    <button
                      className={`leaderboard-tab-vertical ${
                        leaderboardCategory === "day" ? "active" : ""
                      }`}
                      onClick={() => setLeaderboardCategory("day")}
                    >
                      <span>{t("leaderboard.day")}</span>
                      {leaderboardCategory === "day" && timeRemaining && (
                        <span className="leaderboard-countdown-inline">
                          {timeRemaining}
                        </span>
                      )}
                    </button>
                    <button
                      className={`leaderboard-tab-vertical ${
                        leaderboardCategory === "month" ? "active" : ""
                      }`}
                      onClick={() => setLeaderboardCategory("month")}
                    >
                      <span>{t("leaderboard.month")}</span>
                      {leaderboardCategory === "month" && timeRemaining && (
                        <span className="leaderboard-countdown-inline">
                          {timeRemaining}
                        </span>
                      )}
                    </button>
                    <button
                      className={`leaderboard-tab-vertical ${
                        leaderboardCategory === "all-time" ? "active" : ""
                      }`}
                      onClick={() => setLeaderboardCategory("all-time")}
                    >
                      {t("leaderboard.allTime")}
                    </button>
                  </div>
                </div>

                {/* Columna derecha: Tabla de clasificación */}
                <div className="leaderboard-main">
                  {loadingLeaderboard ? (
                    <div className="leaderboard-loading">
                      <p>{t("leaderboard.loading")}</p>
                    </div>
                  ) : leaderboardPlayers.length === 0 ? (
                    <div className="leaderboard-empty">
                      <p>{t("leaderboard.noPlayers")}</p>
                    </div>
                  ) : (
                    <div className="leaderboard-table">
                      <div className="leaderboard-header">
                        <div className="leaderboard-header-rank">
                          {t("leaderboard.rank")}
                        </div>
                        <div className="leaderboard-header-name">
                          {t("leaderboard.player")}
                        </div>
                        <div className="leaderboard-header-elo">
                          {leaderboardCategory === "all-time"
                            ? t("leaderboard.elo")
                            : t("leaderboard.eloChange")}
                        </div>
                        <div className="leaderboard-header-wr">
                          {t("leaderboard.winRate")}
                        </div>
                      </div>
                      <div className="leaderboard-body">
                        {leaderboardPlayers.map((player, index) => {
                          const isCurrentUser = user?.id === player.user_id;
                          const displayValue =
                            leaderboardCategory === "all-time"
                              ? player.elo_rating.toLocaleString()
                              : player.elo_change !== undefined
                              ? `${
                                  player.elo_change > 0 ? "+" : ""
                                }${player.elo_change.toLocaleString()}`
                              : "0";
                          return (
                            <div
                              key={player.user_id}
                              className={`leaderboard-row ${
                                isCurrentUser ? "leaderboard-row-current" : ""
                              }`}
                            >
                              <div className="leaderboard-rank">
                                #{index + 1}
                              </div>
                              <div className="leaderboard-name">
                                {player.name || t("defaults.unknownPlayer")}
                              </div>
                              <div
                                className={`leaderboard-elo ${
                                  leaderboardCategory !== "all-time" &&
                                  player.elo_change !== undefined
                                    ? player.elo_change > 0
                                      ? "elo-positive"
                                      : player.elo_change < 0
                                      ? "elo-negative"
                                      : ""
                                    : ""
                                }`}
                              >
                                {displayValue}
                              </div>
                              <div className="leaderboard-wr">
                                {player.total_games > 0
                                  ? `${(player.win_rate * 100).toFixed(1)}%`
                                  : "0%"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === "lobby" && (
          <div className="lobby">
            <div className="lobby-content">
              {/* Left column: Player list */}
              <div className="lobby-players">
                <h2>
                  {t("lobby.players")} ({lobbyPlayers.length})
                </h2>
                <div className="players-list">
                  {lobbyPlayers.length === 0 ? (
                    <p className="waiting-text">
                      {t("lobby.waitingForPlayers")}
                    </p>
                  ) : (
                    lobbyPlayers.map((player) => (
                      <div key={player.id} className="player-item">
                        <div
                          className="player-color-indicator"
                          style={{ backgroundColor: player.color }}
                        />
                        <span className="player-name">{player.name}</span>
                        {player.elo_rating !== undefined && (
                          <span className="player-elo">
                            {player.elo_rating.toLocaleString()}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              {/* Right column: Actions */}
              <div className="lobby-actions">
                <button
                  onClick={() => {
                    const currentPlayer = lobbyPlayers.find(
                      (p) => p.id === localPlayerId
                    );
                    if (currentPlayer) {
                      setShowColorPicker(true);
                    }
                  }}
                  className="change-color-button"
                >
                  {t("lobby.changeColor")}
                </button>
                <button
                  onClick={handleStartGameFromLobby}
                  className="start-button"
                  disabled={lobbyPlayers.length < 2}
                  style={{
                    backgroundColor: preferredColor,
                  }}
                >
                  {lobbyPlayers.length < 2
                    ? t("lobby.waitingForMorePlayers")
                    : t("lobby.start")}
                </button>
                <button
                  onClick={() => {
                    if (gameRef.current) {
                      const networkClient = gameRef.current.getNetworkClient();
                      if (networkClient) {
                        networkClient.disconnect();
                      }
                      gameRef.current.destroy();
                      gameRef.current = new Game("gameCanvas");
                    }
                    setCurrentView("menu");
                    setLobbyPlayers([]);
                    setLocalPlayerId(null);
                  }}
                  className="back-button"
                >
                  {t("lobby.backToMenu")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Player Sidebar Menu */}
        {showPlayerSidebar && (
          <>
            <div
              className="player-sidebar-overlay"
              onClick={() => setShowPlayerSidebar(false)}
            />
            <div className="player-sidebar">
              <div className="player-sidebar-content">
                <div className="player-sidebar-section">
                  <div className="player-sidebar-avatar">
                    <div
                      className="player-sidebar-avatar-color"
                      style={{ backgroundColor: preferredColor }}
                      onClick={() => setShowColorPicker(true)}
                      title="Click to change color"
                    />
                  </div>
                  <div className="player-sidebar-info">
                    {isEditingName ? (
                      <div className="player-sidebar-name-edit">
                        <input
                          type="text"
                          value={nameEditValue}
                          onChange={(e) => setNameEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveDisplayName();
                            } else if (e.key === "Escape") {
                              setIsEditingName(false);
                              setNameEditValue(playerDisplayName);
                            }
                          }}
                          className="player-sidebar-name-input"
                          maxLength={50}
                          autoFocus
                        />
                        <div className="player-sidebar-name-actions">
                          <button
                            onClick={handleSaveDisplayName}
                            className="player-sidebar-name-save"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingName(false);
                              setNameEditValue(playerDisplayName);
                            }}
                            className="player-sidebar-name-cancel"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="player-sidebar-name"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (currentView === "game" && !gameOverState) {
                            return;
                          }
                          setNameEditValue(
                            playerDisplayName ||
                              (user
                                ? user.user_metadata?.full_name ||
                                  user.email?.split("@")[0] ||
                                  "Player"
                                : t("defaults.guestPlayer"))
                          );
                          setIsEditingName(true);
                        }}
                        style={{
                          cursor:
                            currentView === "game" && !gameOverState
                              ? "default"
                              : "pointer",
                          opacity:
                            currentView === "game" && !gameOverState ? 0.6 : 1,
                        }}
                        title={
                          currentView === "game" && !gameOverState
                            ? "No puedes cambiar tu nombre durante una partida"
                            : "Click para editar"
                        }
                      >
                        <span className="player-sidebar-name-text">
                          {playerDisplayName ||
                            (user
                              ? user.user_metadata?.full_name ||
                                user.email?.split("@")[0] ||
                                "Player"
                              : "Guest Player")}
                        </span>
                        {!(currentView === "game" && !gameOverState) && (
                          <span
                            className="player-sidebar-name-edit-icon"
                            title="Click para editar"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (currentView === "game" && !gameOverState) {
                                return;
                              }
                              setNameEditValue(
                                playerDisplayName ||
                                  (user
                                    ? user.user_metadata?.full_name ||
                                      user.email?.split("@")[0] ||
                                      "Player"
                                    : t("defaults.guestPlayer"))
                              );
                              setIsEditingName(true);
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </span>
                        )}
                      </div>
                    )}
                    <div className="player-sidebar-email">
                      {user?.email || "Playing as guest"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {currentView === "game" && (
          <div className="game-hud">
            {/* Panel izquierdo: Info del juego */}
            <div
              className="hud-left-panel"
              style={{
                width: `${hudLeftPanelWidth}px`,
              }}
            >
              {roundInfo && roundInfo.currentRound && roundInfo.totalRounds && (
                <div className="round-indicator">
                  {t("gameHud.round")} {roundInfo.currentRound}/
                  {roundInfo.totalRounds}
                </div>
              )}
              {gameRef.current?.isUsingNetwork() && (
                <div className="connection-status">
                  {gameRef.current?.getNetworkClient()?.getIsConnected() ? (
                    <span style={{ color: "#4CAF50" }}>
                      {t("gameHud.connected")}
                    </span>
                  ) : (
                    <span style={{ color: "#f44336" }}>
                      {t("gameHud.disconnected")}
                    </span>
                  )}
                </div>
              )}
              {boostState && (
                <div className="hud-boost-container">
                  <BoostBar
                    charge={boostState.charge}
                    active={boostState.active}
                    remaining={boostState.remaining}
                  />
                </div>
              )}
            </div>

            {/* Panel derecho: Clasificación de jugadores */}
            <div
              className="hud-right-panel"
              style={{
                width: `${hudRightPanelWidth}px`,
              }}
            >
              <div className="leaderboard">
                <h3 className="leaderboard-title">
                  {t("gameHud.classification")}
                </h3>
                <div className="leaderboard-list">
                  {leaderboardData.map((player, index) => (
                    <div
                      key={player.id}
                      className={`leaderboard-item ${
                        !player.alive ? "eliminated" : ""
                      }`}
                    >
                      <div className="leaderboard-rank">#{index + 1}</div>
                      <div
                        className="leaderboard-name"
                        style={{ color: player.color }}
                      >
                        {player.name || t("defaults.unknownPlayer")}
                      </div>
                      <div className="leaderboard-points">
                        {player.points} {t("gameHud.pts")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Player Sidebar Menu */}
        {showPlayerSidebar && (
          <>
            <div
              className="player-sidebar-overlay"
              onClick={() => setShowPlayerSidebar(false)}
            />
            <div className="player-sidebar">
              <div className="player-sidebar-content">
                <div className="player-sidebar-section">
                  <div className="player-sidebar-avatar">
                    <div
                      className="player-sidebar-avatar-color"
                      style={{ backgroundColor: preferredColor }}
                      onClick={() => setShowColorPicker(true)}
                      title="Click to change color"
                    />
                  </div>
                  <div className="player-sidebar-info">
                    {isEditingName ? (
                      <div className="player-sidebar-name-edit">
                        <input
                          type="text"
                          value={nameEditValue}
                          onChange={(e) => setNameEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveDisplayName();
                            } else if (e.key === "Escape") {
                              setIsEditingName(false);
                              setNameEditValue(playerDisplayName);
                            }
                          }}
                          className="player-sidebar-name-input"
                          maxLength={50}
                          autoFocus
                        />
                        <div className="player-sidebar-name-actions">
                          <button
                            onClick={handleSaveDisplayName}
                            className="player-sidebar-name-save"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingName(false);
                              setNameEditValue(playerDisplayName);
                            }}
                            className="player-sidebar-name-cancel"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="player-sidebar-name"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevenir que el click se propague
                          // Solo permitir editar si no estamos en una partida activa
                          if (currentView === "game" && !gameOverState) {
                            return; // No hacer nada si estamos en partida activa
                          }
                          setNameEditValue(
                            playerDisplayName ||
                              (user
                                ? user.user_metadata?.full_name ||
                                  user.email?.split("@")[0] ||
                                  "Player"
                                : t("defaults.guestPlayer"))
                          );
                          setIsEditingName(true);
                        }}
                        style={{
                          cursor:
                            currentView === "game" && !gameOverState
                              ? "default"
                              : "pointer",
                          opacity:
                            currentView === "game" && !gameOverState ? 0.6 : 1,
                        }}
                        title={
                          currentView === "game" && !gameOverState
                            ? "No puedes cambiar tu nombre durante una partida"
                            : "Click para editar"
                        }
                      >
                        <span className="player-sidebar-name-text">
                          {playerDisplayName ||
                            (user
                              ? user.user_metadata?.full_name ||
                                user.email?.split("@")[0] ||
                                "Player"
                              : "Guest Player")}
                        </span>
                        {!(currentView === "game" && !gameOverState) && (
                          <span
                            className="player-sidebar-name-edit-icon"
                            title="Click para editar"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (currentView === "game" && !gameOverState) {
                                return;
                              }
                              setNameEditValue(
                                playerDisplayName ||
                                  (user
                                    ? user.user_metadata?.full_name ||
                                      user.email?.split("@")[0] ||
                                      "Player"
                                    : t("defaults.guestPlayer"))
                              );
                              setIsEditingName(true);
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </span>
                        )}
                      </div>
                    )}
                    <div className="player-sidebar-email">
                      {user?.email || "Playing as guest"}
                    </div>
                  </div>
                </div>
                {/* ESTADÍSTICAS */}
                {user && (
                  <div className="player-sidebar-section">
                    <h3 className="player-sidebar-stats-title">
                      {t("playerSidebar.stats")}
                    </h3>
                    <div
                      className="player-sidebar-stats"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {playerStats ? (
                        <>
                          <div
                            className="player-sidebar-stat-item"
                            style={{
                              display: "flex",
                              padding: "10px 12px",
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: "6px",
                            }}
                          >
                            <span
                              className="player-sidebar-stat-label"
                              style={{
                                color: "rgba(255, 255, 255, 0.7)",
                                fontSize: "0.9rem",
                              }}
                            >
                              {t("playerSidebar.rating")}:
                            </span>
                            <span
                              className="player-sidebar-stat-value"
                              style={{
                                color: "#ffffff",
                                fontSize: "1rem",
                                fontWeight: "600",
                                marginLeft: "auto",
                              }}
                            >
                              {playerStats.elo_rating.toLocaleString()}
                            </span>
                            {playerStats.rating_change !== 0 && (
                              <span
                                className={`player-sidebar-rating-change ${
                                  playerStats.rating_change > 0
                                    ? "rating-positive"
                                    : "rating-negative"
                                }`}
                                style={{ marginLeft: "8px" }}
                              >
                                {playerStats.rating_change > 0 ? "+" : ""}
                                {playerStats.rating_change}
                              </span>
                            )}
                          </div>
                          <div
                            className="player-sidebar-stat-item"
                            style={{
                              display: "flex",
                              padding: "10px 12px",
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: "6px",
                            }}
                          >
                            <span
                              className="player-sidebar-stat-label"
                              style={{
                                color: "rgba(255, 255, 255, 0.7)",
                                fontSize: "0.9rem",
                              }}
                            >
                              {t("playerSidebar.peakRating")}:
                            </span>
                            <span
                              className="player-sidebar-stat-value"
                              style={{
                                color: "#ffffff",
                                fontSize: "1rem",
                                fontWeight: "600",
                                marginLeft: "auto",
                              }}
                            >
                              {playerStats.peak_rating.toLocaleString()}
                            </span>
                          </div>
                          <div
                            className="player-sidebar-stat-item"
                            style={{
                              display: "flex",
                              padding: "10px 12px",
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: "6px",
                            }}
                          >
                            <span
                              className="player-sidebar-stat-label"
                              style={{
                                color: "rgba(255, 255, 255, 0.7)",
                                fontSize: "0.9rem",
                              }}
                            >
                              {t("playerSidebar.games")}:
                            </span>
                            <span
                              className="player-sidebar-stat-value"
                              style={{
                                color: "#ffffff",
                                fontSize: "1rem",
                                fontWeight: "600",
                                marginLeft: "auto",
                              }}
                            >
                              {playerStats.total_games}
                            </span>
                          </div>
                          <div
                            className="player-sidebar-stat-item"
                            style={{
                              display: "flex",
                              padding: "10px 12px",
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: "6px",
                            }}
                          >
                            <span
                              className="player-sidebar-stat-label"
                              style={{
                                color: "rgba(255, 255, 255, 0.7)",
                                fontSize: "0.9rem",
                              }}
                            >
                              {t("playerSidebar.wins")}:
                            </span>
                            <span
                              className="player-sidebar-stat-value"
                              style={{
                                color: "#ffffff",
                                fontSize: "1rem",
                                fontWeight: "600",
                                marginLeft: "auto",
                              }}
                            >
                              {playerStats.total_wins}
                            </span>
                            {playerStats.total_games > 0 && (
                              <span
                                className="player-sidebar-stat-secondary"
                                style={{
                                  marginLeft: "6px",
                                  color: "rgba(255, 255, 255, 0.5)",
                                  fontSize: "0.85rem",
                                }}
                              >
                                (
                                {(
                                  (playerStats.total_wins /
                                    playerStats.total_games) *
                                  100
                                ).toFixed(1)}
                                %)
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div
                          className="player-sidebar-stat-item"
                          style={{ display: "flex", padding: "10px 12px" }}
                        >
                          <span
                            className="player-sidebar-stat-label"
                            style={{
                              color: "rgba(255, 255, 255, 0.7)",
                              fontSize: "0.9rem",
                            }}
                          >
                            {t("playerSidebar.loadingStats")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Language selector modal */}
        {showLanguageSelector && (
          <LanguageSelectorModal
            isOpen={showLanguageSelector}
            onClose={() => setShowLanguageSelector(false)}
          />
        )}

        {/* Color picker modal - Available from menu and lobby */}
        {showColorPicker && (
          <ColorPickerModal
            isOpen={showColorPicker}
            currentColor={
              // Si estamos en el lobby, usar el color del jugador en el lobby
              // Si estamos en el menú, usar el color preferido
              currentView === "lobby" && localPlayerId
                ? lobbyPlayers.find((p) => p.id === localPlayerId)?.color ||
                  preferredColor
                : preferredColor
            }
            usedColors={
              // Solo considerar colores usados si estamos en el lobby
              currentView === "lobby"
                ? new Set(lobbyPlayers.map((p) => p.color))
                : new Set()
            }
            onClose={() => setShowColorPicker(false)}
            onConfirm={(color) => {
              // Si estamos en el lobby y hay un jugador local, cambiar el color en el juego
              if (currentView === "lobby" && localPlayerId && gameRef.current) {
                const networkClient = gameRef.current.getNetworkClient();
                if (networkClient) {
                  networkClient.changeColor(localPlayerId, color);
                }
              }
              // Siempre guardar como color preferido
              setPreferredColor(color);
              localStorage.setItem("preferredColor", color);
              // Marcar que el jugador ha cambiado su color manualmente
              setHasCustomColor(true);
              localStorage.setItem("hasCustomColor", "true");
              setShowColorPicker(false);
            }}
          />
        )}

        {/* Round summary modal */}
        {roundSummaryState && (
          <RoundSummaryModal
            gameState={roundSummaryState}
            onNextRound={handleNextRound}
            countdown={roundSummaryState.countdown}
            localPlayerId={localPlayerId}
            preferredColor={preferredColor}
          />
        )}

        {/* Game over modal */}
        {gameOverState && (
          <GameOverModal
            gameState={gameOverState}
            onBackToMenu={handleBackToMenuFromGameOver}
            onNextMatch={handleNextMatchFromGameOver}
            localPlayerId={localPlayerId}
            preferredColor={preferredColor}
          />
        )}
      </div>
    </div>
  );
}

export default App;
