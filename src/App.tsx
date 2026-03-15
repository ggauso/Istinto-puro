/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useGameStore } from './store';
import { useAuthStore } from './authStore';
import { HomeScreen } from './components/HomeScreen';
import { GameScreen } from './components/GameScreen';
import { AuthScreen } from './components/AuthScreen';
import { ProfileScreen } from './components/ProfileScreen';

export default function App() {
  const { status } = useGameStore();
  const { initialize, loading } = useAuthStore();
  const [currentScreen, setCurrentScreen] = useState<'home' | 'auth' | 'profile'>('home');

  useEffect(() => {
    initialize();
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
      {currentScreen === 'auth' && <AuthScreen onBack={() => setCurrentScreen('home')} />}
      {currentScreen === 'profile' && <ProfileScreen onBack={() => setCurrentScreen('home')} />}
      {currentScreen === 'home' && (
        <HomeScreen 
          onNavigateToAuth={() => setCurrentScreen('auth')}
          onNavigateToProfile={() => setCurrentScreen('profile')}
        />
      )}
    </div>
  );
}
