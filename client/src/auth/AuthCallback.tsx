// Componente para manejar el callback de OAuth
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { PremiumModel } from '../models/premiumModel';

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Obtener los parámetros de la URL
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Si hay un error en los parámetros de la URL (del servidor de Supabase)
        if (error) {
          console.error('Error en callback de OAuth:', error, errorDescription);
          navigate(`/?error=auth_failed&reason=${encodeURIComponent(errorDescription || error)}`);
          return;
        }

        // Si no hay código, intentar obtener la sesión directamente
        // (puede que Supabase ya haya procesado el callback automáticamente)
        if (!code) {
          console.log('No hay código en la URL, intentando obtener sesión...');
          const { data, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('Error getting session:', sessionError);
            navigate('/?error=auth_failed&reason=no_session');
            return;
          }

          if (data.session) {
            await handleSuccessfulAuth(data.session);
            return;
          } else {
            navigate('/?error=no_session');
            return;
          }
        }

        // Intercambiar el código por una sesión
        console.log('Intercambiando código por sesión...');
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError);
          navigate(`/?error=auth_failed&reason=${encodeURIComponent(exchangeError.message)}`);
          return;
        }

        if (data.session) {
          await handleSuccessfulAuth(data.session);
        } else {
          navigate('/?error=no_session');
        }
      } catch (err: any) {
        console.error('Unexpected error:', err);
        navigate(`/?error=unexpected&reason=${encodeURIComponent(err?.message || 'Unknown error')}`);
      }
    };

    const handleSuccessfulAuth = async (session: any) => {
      try {
        // Usuario autenticado exitosamente
        const user = session.user;
        
        // Verificar si el usuario ya existe antes de crear/actualizar
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        
        // Si no existe el usuario o hay un error (excepto PGRST116 que es "no encontrado"), es nuevo
        const isNewUser = !existingUser || (checkError && (checkError as any).code === 'PGRST116');
        
        // Crear/actualizar perfil en la base de datos
        const { error: profileError } = await supabase
          .from('users')
          .upsert(
            {
              id: user.id,
              email: user.email,
              name: user.user_metadata?.full_name || user.email?.split('@')[0],
              avatar_url: user.user_metadata?.avatar_url,
            },
            { onConflict: 'id' }
          );

        if (profileError) {
          console.error('Error creating/updating profile:', profileError);
          // No redirigir con error, solo loggear - el usuario está autenticado
        } else if (isNewUser) {
          // Si es un usuario nuevo, darle 200 loops de bienvenida
          try {
            await PremiumModel.addLoops(
              user.id,
              200,
              'reward',
              'welcome_bonus',
              'Bienvenida - 200 Loops de regalo'
            );
            console.log('✅ 200 Loops otorgados al nuevo usuario');
            // Marcar que se debe mostrar el modal de bienvenida
            localStorage.setItem('showWelcomeBonus', 'true');
          } catch (loopsError) {
            console.error('Error dando loops de bienvenida:', loopsError);
            // No bloquear el flujo si falla dar los loops
          }
        }

        // Limpiar la URL de los parámetros de OAuth
        window.history.replaceState({}, document.title, window.location.pathname);
        
        navigate('/');
      } catch (err) {
        console.error('Error handling successful auth:', err);
        // Aún así redirigir, el usuario está autenticado
        navigate('/');
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Completando autenticación...</p>
    </div>
  );
}

