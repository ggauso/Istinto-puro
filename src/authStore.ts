import { create } from 'zustand';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  favorite_team: string | null;
  privacy_accepted: boolean;
  avatar_url: string | null;
  total_score: number;
  matches_played: number;
  matches_won: number;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfileStats: (isWin: boolean, score: number) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),

  initialize: async () => {
    if (get().initialized) return;

    let session = null;
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
      const response = await Promise.race([supabase.auth.getSession(), timeoutPromise]) as any;
      session = response?.data?.session;
    } catch (e) {
      console.warn('getSession timeout during initialize, continuing without session');
    }
    
    set({ user: session?.user || null, initialized: true });
    
    if (session?.user) {
      await get().fetchProfile(session.user.id);
    }

    set({ loading: false });

    supabase.auth.onAuthStateChange(async (event, currentSession) => {
      set({ user: currentSession?.user || null });
      
      // Fetch profile on sign in, token refresh or password update
      if (currentSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        await get().fetchProfile(currentSession.user.id);
      } else if (!currentSession) {
        set({ profile: null });
      }
    });
  },

  fetchProfile: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      set({ profile: data });
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  },

  signOut: async () => {
    try {
      set({ loading: true });
      const timeoutPromise = new Promise<{ error: any }>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: il server non ha risposto.')), 5000)
      );
      await Promise.race([
        supabase.auth.signOut(),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('SignOut error:', error);
    } finally {
      set({ user: null, profile: null, loading: false });
    }
  },

  updateProfileStats: async (isWin: boolean, score: number) => {
    const { user, profile } = get();
    if (!user || !profile) return;

    try {
      const newMatchesPlayed = (profile.matches_played || 0) + 1;
      const newMatchesWon = (profile.matches_won || 0) + (isWin ? 1 : 0);
      const newTotalScore = (profile.total_score || 0) + score;

      const { error } = await supabase
        .from('profiles')
        .update({
          matches_played: newMatchesPlayed,
          matches_won: newMatchesWon,
          total_score: newTotalScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile stats:', error);
        return;
      }

      set({
        profile: {
          ...profile,
          matches_played: newMatchesPlayed,
          matches_won: newMatchesWon,
          total_score: newTotalScore
        }
      });
    } catch (error) {
      console.error('Error in updateProfileStats:', error);
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const { user, profile } = get();
    if (!user || !profile) {
      console.log('No user or profile in updateProfile');
      return;
    }

    let timeoutId: NodeJS.Timeout;
    try {
      console.log('Calling Supabase update with:', updates);
      
      // Convert empty strings to null for database consistency
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [k, v === '' ? null : v])
      );

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout: Il server non ha risposto entro 10 secondi')), 10000);
      });

      const updatePromise = supabase
        .from('profiles')
        .update(cleanUpdates)
        .eq('id', user.id);

      const response = await Promise.race([updatePromise, timeoutPromise]) as any;
      const { data, error } = response;

      console.log('Supabase update response:', { data, error });

      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }

      set({
        profile: {
          ...profile,
          ...updates
        }
      });
    } catch (error) {
      console.error('Error in updateProfile:', error);
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  },

  changePassword: async (newPassword: string): Promise<void> => {
    const { user } = get();
    if (!user) throw new Error('Utente non autenticato');

    const timeoutPromise = new Promise<{ data: any, error: any }>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: il server non ha risposto.')), 10000)
    );

    const { data, error } = await Promise.race([
      supabase.auth.updateUser({ password: newPassword }),
      timeoutPromise
    ]);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('different') || msg.includes('identical') || msg.includes('same as the old')) {
        throw new Error('La nuova password deve essere diversa da quella attuale.');
      }
      throw error;
    }
  }
}));
