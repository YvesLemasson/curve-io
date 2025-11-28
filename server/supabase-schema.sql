-- Schema para curve.io en Supabase
-- Ejecutar este SQL en el SQL Editor de Supabase

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios (extiende auth.users de Supabase)
-- Nota: Supabase ya tiene auth.users, pero creamos una tabla de perfil
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_id TEXT UNIQUE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de partidas
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
  winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de participantes en partidas
CREATE TABLE IF NOT EXISTS public.game_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  position INTEGER, -- Posición final (1 = ganador, 2 = segundo, etc.)
  eliminated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, user_id) -- Un usuario solo puede participar una vez por partida
);

-- Tabla de estadísticas agregadas de jugadores
CREATE TABLE IF NOT EXISTS public.player_stats (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_games INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar performance de queries
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_winner ON public.games(winner_id);
CREATE INDEX IF NOT EXISTS idx_games_created ON public.games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_game ON public.game_participants(game_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON public.game_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_score ON public.game_participants(score DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_best_score ON public.player_stats(best_score DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_wins ON public.player_stats(total_wins DESC);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_stats_updated_at BEFORE UPDATE ON public.player_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para actualizar estadísticas cuando se crea un participante
CREATE OR REPLACE FUNCTION update_player_stats_on_game_end()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar o insertar estadísticas del jugador
  INSERT INTO public.player_stats (user_id, total_games, total_wins, total_score, best_score)
  VALUES (
    NEW.user_id,
    1,
    CASE WHEN NEW.position = 1 THEN 1 ELSE 0 END,
    NEW.score,
    NEW.score
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_games = player_stats.total_games + 1,
    total_wins = player_stats.total_wins + CASE WHEN NEW.position = 1 THEN 1 ELSE 0 END,
    total_score = player_stats.total_score + NEW.score,
    best_score = GREATEST(player_stats.best_score, NEW.score),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stats automáticamente
CREATE TRIGGER update_stats_on_participant_insert
  AFTER INSERT ON public.game_participants
  FOR EACH ROW EXECUTE FUNCTION update_player_stats_on_game_end();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas
-- Los usuarios pueden leer sus propios datos
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Cualquiera puede leer partidas (para leaderboards)
CREATE POLICY "Anyone can read games" ON public.games
  FOR SELECT USING (true);

-- Solo usuarios autenticados pueden crear partidas
CREATE POLICY "Authenticated users can create games" ON public.games
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Cualquiera puede leer participantes
CREATE POLICY "Anyone can read participants" ON public.game_participants
  FOR SELECT USING (true);

-- Solo usuarios autenticados pueden crear participantes
CREATE POLICY "Authenticated users can create participants" ON public.game_participants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Cualquiera puede leer estadísticas (para leaderboards)
CREATE POLICY "Anyone can read stats" ON public.player_stats
  FOR SELECT USING (true);

-- Solo el sistema puede actualizar estadísticas (vía trigger)
CREATE POLICY "System can update stats" ON public.player_stats
  FOR UPDATE USING (false); -- Las actualizaciones se hacen vía triggers

