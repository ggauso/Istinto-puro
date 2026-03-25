/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useGameStore } from './store';
import { useAuthStore } from './authStore';
import { supabase } from './lib/supabase';
import { HomeScreen } from './components/HomeScreen';
import { GameScreen } from './components/GameScreen';
import { AuthScreen } from './components/AuthScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';

export default function App() {
  const { status } = useGameStore();
  const { initialize, loading } = useAuthStore();
  const [currentScreen, setCurrentScreen] = useState<'home' | 'auth' | 'profile' | 'leaderboard'>('home');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    initialize();

    // Intercetta il callback del link di recupero password inviato da Supabase.
    // Quando l'utente clicca il link, Supabase emette PASSWORD_RECOVERY prima di autenticarlo.
    // In questo momento forziamo la schermata di reset invece di permettere l'accesso normale.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setCurrentScreen('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [initialize]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  // If game is active, show game screen
  if (status !== 'idle' && status !== 'searching') {
    return (
      <div className="min-h-screen bg-[#121212] text-white font-sans selection:bg-[#FFD700] selection:text-black">
        <GameScreen />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans selection:bg-[#FFD700] selection:text-black">
      {currentScreen === 'auth' && <AuthScreen 
        onBack={() => setCurrentScreen('home')} 
        isPasswordRecovery={isPasswordRecovery}
        onPasswordRecoveryDone={() => {
          setIsPasswordRecovery(false);
          setCurrentScreen('home');
        }}
      />}
      {currentScreen === 'profile' && <ProfileScreen onBack={() => setCurrentScreen('home')} />}
      {currentScreen === 'leaderboard' && <LeaderboardScreen onBack={() => setCurrentScreen('home')} />}
      {currentScreen === 'home' && (
        <HomeScreen
          onNavigateToAuth={() => setCurrentScreen('auth')}
          onNavigateToProfile={() => setCurrentScreen('profile')}
          onNavigateToLeaderboard={() => setCurrentScreen('leaderboard')}
        />
      )}
    </div>
  );
}
