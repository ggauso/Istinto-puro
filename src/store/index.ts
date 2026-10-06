import { create } from 'zustand';
import { GameState } from './types';
import { createMatchmakingSlice } from './matchmakingSlice';
import { createGameplaySlice } from './gameplaySlice';
import { createLifecycleSlice } from './lifecycleSlice';

export type { Team, MatchData, GameState } from './types';

export const useGameStore = create<GameState>()((...a) => ({
  ...createMatchmakingSlice(...a),
  ...createGameplaySlice(...a),
  ...createLifecycleSlice(...a),
}));
