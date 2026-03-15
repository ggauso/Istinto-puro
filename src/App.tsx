/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useGameStore } from './store';
import { HomeScreen } from './components/HomeScreen';
import { GameScreen } from './components/GameScreen';

export default function App() {
  const { status } = useGameStore();

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans selection:bg-[#FFD700] selection:text-black">
      {status === 'idle' || status === 'searching' ? <HomeScreen /> : <GameScreen />}
    </div>
  );
}
