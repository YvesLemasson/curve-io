// Main React application component
// Handles routing and general UI structure

import { useState, useEffect, useRef } from "react";
import { Game } from "../game/game";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../config/supabase";
import curvePhrasesData from "../data/curvePhrases.json";
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
    <div className="boost-bar-container">
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

// Game over modal component
function GameOverModal({
  gameState,
  onBackToMenu,
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
  } | null;
  onBackToMenu: () => void;
}) {
  if (!gameState) return null;

  const winner = gameState.winnerId
    ? gameState.players.find((p) => p.id === gameState.winnerId)
    : null;
  const gameDuration = Math.floor(gameState.tick / 60); // Aproximadamente segundos (60 ticks por segundo)

  // Ordenar jugadores por puntos (mayor a menor)
  const playersWithPoints = gameState.players
    .map((player) => ({
      ...player,
      points: gameState.playerPoints?.[player.id] || 0,
    }))
    .sort((a, b) => b.points - a.points);

  return (
    <div className="game-over-modal-overlay">
      <div className="game-over-modal">
        <h1 className="game-over-title">
          {winner ? "🏆 Game Over!" : "🤝 Tie"}
        </h1>

        <div className="game-over-content">
          {/* Left column: Game information */}
          <div className="game-over-left">
            {winner ? (
              <div className="winner-section">
                <div className="winner-name" style={{ color: winner.color }}>
                  {winner.name}
                </div>
                <p className="winner-label">is the winner</p>
                {gameState.playerPoints && (
                  <p className="winner-points">
                    {gameState.playerPoints[winner.id] || 0} puntos totales
                  </p>
                )}
              </div>
            ) : (
              <div className="tie-section">
                <p>All players were eliminated</p>
              </div>
            )}

            <div className="game-summary">
              <h2>Resumen del Juego</h2>

              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">Rondas:</span>
                  <span className="stat-value">
                    {gameState.totalRounds || 1} rondas
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Duración:</span>
                  <span className="stat-value">{gameDuration}s</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Jugadores:</span>
                  <span className="stat-value">{gameState.players.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Player information with points */}
          <div className="game-over-right">
            <div className="players-summary">
              <h3>Puntos Finales</h3>
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
                      <span className="player-points">{player.points} pts</span>
                      {isWinner && (
                        <span className="player-status winner-status">🏆</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <button onClick={onBackToMenu} className="back-to-menu-button">
          Back to Menu
        </button>
      </div>
    </div>
  );
}

// Round summary modal component
function RoundSummaryModal({
  gameState,
  onNextRound,
  countdown,
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
}) {
  if (!gameState) return null;

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
        <h1 className="game-over-title">Ronda {currentRound} Terminada</h1>

        <div className="game-over-content">
          {/* Left column: Round information */}
          <div className="game-over-left">
            <div className="round-summary">
              <h2>Resumen de la Ronda</h2>
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">Ronda:</span>
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
              <h3>Puntos de esta Ronda</h3>
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
                      {index === 0 && (
                        <span className="player-status winner-status">🏆</span>
                      )}
                      <span className="player-points">
                        +{player.roundPoints} pts
                      </span>
                      <span className="player-total-points">
                        (Total: {player.totalPoints})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onNextRound}
          className="back-to-menu-button"
          disabled={countdown !== undefined && countdown >= 0}
        >
          {countdown !== undefined && countdown > 0
            ? `Next Round (${countdown})`
            : countdown === 0
            ? "Starting..."
            : "Next Round"}
        </button>
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
        <h2>Seleccionar Color</h2>
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
                title={isUsed ? "Color en uso" : color}
              >
                {isSelected && <span className="check-mark">✓</span>}
                {isUsed && <span className="used-mark">✗</span>}
              </button>
            );
          })}
        </div>
        <div className="color-picker-actions">
          <button className="color-picker-cancel" onClick={onClose}>
            Cancel
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
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// Frases aleatorias sobre curves (cargadas desde JSON)
const curvePhrases = curvePhrasesData.curve_phrases;

function App() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<"menu" | "game" | "lobby">(
    "menu"
  );
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
    Array<{ id: string; name: string; color: string }>
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
  const gameRef = useRef<Game | null>(null);

  // Seleccionar una frase aleatoria al cargar y reemplazar {player} con el nombre del jugador
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * curvePhrases.length);
    const selectedPhrase = curvePhrases[randomIndex];

    // Obtener el nombre del jugador para reemplazar {player}
    const playerName =
      playerDisplayName ||
      (user
        ? user.user_metadata?.full_name || user.email?.split("@")[0] || "Player"
        : "Guest Player");

    // Reemplazar {player} con el nombre del jugador
    const phraseWithPlayer = selectedPhrase.replace(/{player}/g, playerName);
    setRandomCurvePhrase(phraseWithPlayer);
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
              "Player";
            setPlayerDisplayName(defaultName);
          }
        } catch (err) {
          console.error("Error loading player name:", err);
          // Fallback al nombre por defecto
          const defaultName =
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "Player";
          setPlayerDisplayName(defaultName);
        }
      } else {
        // Usuario no autenticado - cargar desde localStorage
        const savedGuestName = localStorage.getItem("guestPlayerName");
        if (savedGuestName) {
          setPlayerDisplayName(savedGuestName);
        } else {
          setPlayerDisplayName("Guest Player");
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
      alert("El nombre no puede estar vacío");
      return;
    }

    if (trimmedName.length > 50) {
      alert("El nombre no puede tener más de 50 caracteres");
      return;
    }

    try {
      // Verificar que no estemos en una partida activa
      if (currentView === "game" && !gameOverState) {
        alert("No puedes cambiar tu nombre durante una partida activa");
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
        console.log("✅ Nombre actualizado en BD:", trimmedName);
      } else {
        // Usuario guest - guardar en localStorage
        localStorage.setItem("guestPlayerName", trimmedName);
        setPlayerDisplayName(trimmedName);
        setIsEditingName(false);
        console.log(
          "✅ Nombre de guest guardado en localStorage:",
          trimmedName
        );
      }
    } catch (error: any) {
      console.error("Error saving display name:", error);
      alert(`Error al guardar el nombre: ${error.message}`);
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
          console.log(
            `🔄 [Cliente] Estado cambió a 'playing', cerrando modal de resumen de ronda`
          );
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
        console.log(
          `⚠️  No se puede solicitar siguiente ronda: estado actual es ${gameState.gameStatus}`
        );
        return;
      }

      // Verificar que no haya una cuenta atrás en curso
      if (
        gameState.nextRoundCountdown !== undefined &&
        gameState.nextRoundCountdown > 0
      ) {
        console.log(
          `⚠️  Ya hay una cuenta atrás en curso: ${gameState.nextRoundCountdown}`
        );
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
        alert(`Error de conexión: ${error}`);
      } else {
        // Para otros errores, solo loggear
        console.warn("[App] Error de red (no crítico):", error);
      }
    });

    networkClient.onConnect(() => {
      console.log("[App] ✅ Conectado al servidor, uniéndose al lobby...");

      // Enviar user_id si el usuario está autenticado
      if (user?.id) {
        console.log("[App] 🔐 Enviando autenticación de usuario:", user.id);
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
              : localStorage.getItem("guestPlayerName") || "Guest Player");
          // Obtener color preferido desde localStorage
          const savedPreferredColor =
            localStorage.getItem("preferredColor") || preferredColor;
          console.log(
            "[App] 👤 Uniéndose al lobby como:",
            playerName,
            "con color preferido:",
            savedPreferredColor
          );
          gameRef.current.joinLobby(playerName, savedPreferredColor);
        } else {
          console.error(
            "[App] ❌ gameRef.current es null, no se puede unir al lobby"
          );
        }
      }, 100);
    });

    // Cambiar a vista de lobby primero
    setCurrentView("lobby");

    // Connect to server
    networkClient.connect();
  };

  // Function to start local game
  const handleStartLocalGame = () => {
    if (gameRef.current) {
      // Si ya existe, destruirlo y crear uno nuevo
      if (gameRef.current.isUsingNetwork()) {
        gameRef.current.destroy();
        gameRef.current = new Game("gameCanvas", false);
      }

      gameRef.current.init(4); // 4 jugadores
      gameRef.current.start();
      setCurrentView("game");
    }
  };

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
                  <p className="welcome-text">Loading...</p>
                ) : (
                  <p className="welcome-text">
                    {randomCurvePhrase || "Loading..."}
                  </p>
                )}
              </div>

              {/* Bottom: Controls info */}
              <div className="controls-info">
                <h3>CONTROLS</h3>
                {isMobile ? (
                  <>
                    <p>Tap left side : Turn left</p>
                    <p>Tap right side : Turn right</p>
                    <p>Tap both sides : Activate boost (speed +50%)</p>
                  </>
                ) : (
                  <>
                    <p>A / ← : Turn left</p>
                    <p>D / → : Turn right</p>
                    <p>A + D : Activate boost (speed +50%)</p>
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
                aria-label="Open player menu"
                title="Player information"
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
                  title={
                    !user
                      ? "Play as a guest (no account required)"
                      : "Play online with your account"
                  }
                >
                  {!user ? "Play as guest" : "Play Online"}
                </button>
                <button onClick={handleStartLocalGame} className="menu-option">
                  Local Game
                </button>
                <button
                  onClick={() => {
                    if (user) {
                      signOut();
                    } else {
                      signInWithGoogle();
                    }
                  }}
                  className="menu-option"
                >
                  {user ? "Sign Out" : "Sign In"}
                </button>
              </div>

              {showInstallButton && (
                <button
                  onClick={handleInstallClick}
                  className="install-button"
                  title="Install application"
                >
                  Install
                </button>
              )}
            </div>
          </div>
        )}

        {currentView === "lobby" && (
          <div className="lobby">
            <div className="lobby-content">
              {/* Left column: Player list */}
              <div className="lobby-players">
                <h2>Players ({lobbyPlayers.length})</h2>
                <div className="players-list">
                  {lobbyPlayers.length === 0 ? (
                    <p className="waiting-text">Waiting for players...</p>
                  ) : (
                    lobbyPlayers.map((player) => (
                      <div key={player.id} className="player-item">
                        <div
                          className="player-color-indicator"
                          style={{ backgroundColor: player.color }}
                        />
                        <span className="player-name">{player.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {/* Right column: Actions */}
              <div className="lobby-actions">
                <h1>Lobby</h1>
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
                  Change Color
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
                    ? "Waiting for more players..."
                    : "Start"}
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
                  Back to Menu
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
              <div className="player-sidebar-header">
                <h2 className="player-sidebar-title">Player Info</h2>
                <button
                  className="player-sidebar-close"
                  onClick={() => setShowPlayerSidebar(false)}
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>
              <div className="player-sidebar-content">
                <div className="player-sidebar-section">
                  <div className="player-sidebar-avatar">
                    <div
                      className="player-sidebar-avatar-color"
                      style={{ backgroundColor: preferredColor }}
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
                          console.log("Click en nombre, activando edición");
                          setNameEditValue(
                            playerDisplayName ||
                              (user
                                ? user.user_metadata?.full_name ||
                                  user.email?.split("@")[0] ||
                                  "Player"
                                : "Guest Player")
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
                              console.log("Click en icono, activando edición");
                              setNameEditValue(
                                playerDisplayName ||
                                  (user
                                    ? user.user_metadata?.full_name ||
                                      user.email?.split("@")[0] ||
                                      "Player"
                                    : "Guest Player")
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
                <div className="player-sidebar-section">
                  <div className="player-sidebar-color-display">
                    <div
                      className="player-sidebar-color-preview"
                      style={{ backgroundColor: preferredColor }}
                    />
                    <span className="player-sidebar-color-value">
                      {preferredColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {currentView === "game" && (
          <div className="game-hud">
            {/* Panel izquierdo: Info del juego */}
            <div className="hud-left-panel">
              {roundInfo && roundInfo.currentRound && roundInfo.totalRounds && (
                <div className="round-indicator">
                  Ronda {roundInfo.currentRound}/{roundInfo.totalRounds}
                </div>
              )}
              {gameRef.current?.isUsingNetwork() && (
                <div className="connection-status">
                  {gameRef.current?.getNetworkClient()?.getIsConnected() ? (
                    <span style={{ color: "#4CAF50" }}>● Connected</span>
                  ) : (
                    <span style={{ color: "#f44336" }}>● Disconnected</span>
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
            <div className="hud-right-panel">
              <div className="leaderboard">
                <h3 className="leaderboard-title">Clasificación</h3>
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
                        className="leaderboard-color"
                        style={{ backgroundColor: player.color }}
                      />
                      <div className="leaderboard-name">{player.name}</div>
                      <div className="leaderboard-points">
                        {player.points} pts
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
              <div className="player-sidebar-header">
                <h2 className="player-sidebar-title">Player Info</h2>
                <button
                  className="player-sidebar-close"
                  onClick={() => setShowPlayerSidebar(false)}
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>
              <div className="player-sidebar-content">
                <div className="player-sidebar-section">
                  <div className="player-sidebar-avatar">
                    <div
                      className="player-sidebar-avatar-color"
                      style={{ backgroundColor: preferredColor }}
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
                          console.log("Click en nombre, activando edición");
                          setNameEditValue(
                            playerDisplayName ||
                              (user
                                ? user.user_metadata?.full_name ||
                                  user.email?.split("@")[0] ||
                                  "Player"
                                : "Guest Player")
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
                              console.log("Click en icono, activando edición");
                              setNameEditValue(
                                playerDisplayName ||
                                  (user
                                    ? user.user_metadata?.full_name ||
                                      user.email?.split("@")[0] ||
                                      "Player"
                                    : "Guest Player")
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
                <div className="player-sidebar-section">
                  <div
                    className="player-sidebar-color-display player-sidebar-color-clickable"
                    onClick={() => setShowColorPicker(true)}
                    title="Click to change color"
                  >
                    <div
                      className="player-sidebar-color-preview"
                      style={{ backgroundColor: preferredColor }}
                    />
                    <span className="player-sidebar-color-value">
                      {preferredColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
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
          />
        )}

        {/* Game over modal */}
        {gameOverState && (
          <GameOverModal
            gameState={gameOverState}
            onBackToMenu={handleBackToMenuFromGameOver}
          />
        )}
      </div>
    </div>
  );
}

export default App;
