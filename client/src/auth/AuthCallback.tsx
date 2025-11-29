// Componente para manejar el callback de OAuth
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Manejar el callback de OAuth - Supabase procesa los parámetros de la URL
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          navigate('/?error=auth_failed');
          return;
        }

        if (data.session) {
          // Usuario autenticado exitosamente
          // Crear/actualizar perfil en la base de datos
          const user = data.session.user;
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
          }

          // Limpiar la URL de los parámetros de OAuth
          window.history.replaceState({}, document.title, window.location.pathname);
          
          navigate('/');
        } else {
          navigate('/?error=no_session');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        navigate('/?error=unexpected');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Completando autenticación...</p>
    </div>
  );
}

