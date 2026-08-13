import { create } from 'zustand';
import { supabase } from '../services/supabase';

interface User {
  id: string;
  email: string;
  username?: string;
  trading_mode: string;
  account_balance: number;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, username: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem('auth_token'),
  isLoading: false,
  user: localStorage.getItem('auth_user') ? JSON.parse(localStorage.getItem('auth_user')!) : null,
  token: localStorage.getItem('auth_token'),
  error: null,

  login: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      // Try login with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        set({ error: authError.message, isLoading: false });
        return false;
      }

      if (!data.user) {
        set({ error: 'Falha na autenticação', isLoading: false });
        return false;
      }

      // Fetch user profile from database
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        // Se não existe perfil, criar um
        console.log('Perfil não existe, criando novo...');

        const { data: newProfile, error: createError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: data.user.email,
              username: data.user.email?.split('@')[0] || 'user',
              trading_mode: 'PAPER',
              account_balance: 10000,
            },
          ])
          .select()
          .single();

        if (createError) {
          console.error('Erro ao criar perfil:', createError);
          set({ error: 'Erro ao criar perfil', isLoading: false });
          return false;
        }

        const user: User = {
          id: newProfile.id,
          email: newProfile.email,
          username: newProfile.username,
          trading_mode: newProfile.trading_mode,
          account_balance: newProfile.account_balance,
        };

        localStorage.setItem('auth_token', data.session?.access_token || '');
        localStorage.setItem('auth_user', JSON.stringify(user));

        set({
          isAuthenticated: true,
          user,
          token: data.session?.access_token || '',
          isLoading: false,
        });

        return true;
      }

      const user: User = {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        trading_mode: profile.trading_mode,
        account_balance: profile.account_balance,
      };

      localStorage.setItem('auth_token', data.session?.access_token || '');
      localStorage.setItem('auth_user', JSON.stringify(user));

      set({
        isAuthenticated: true,
        user,
        token: data.session?.access_token || '',
        isLoading: false,
      });

      return true;
    } catch (err: any) {
      console.error('Erro no login:', err);
      set({ error: err.message || 'Erro desconhecido', isLoading: false });
      return false;
    }
  },

  signup: async (email: string, password: string, username: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      // Create user in Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        set({ error: authError.message, isLoading: false });
        return false;
      }

      if (!data.user) {
        set({ error: 'Falha ao criar conta', isLoading: false });
        return false;
      }

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      // If profile exists, use it
      if (existingProfile) {
        const user: User = {
          id: existingProfile.id,
          email: existingProfile.email,
          username: existingProfile.username,
          trading_mode: existingProfile.trading_mode,
          account_balance: existingProfile.account_balance,
        };

        localStorage.setItem('auth_token', data.session?.access_token || '');
        localStorage.setItem('auth_user', JSON.stringify(user));

        set({
          isAuthenticated: true,
          user,
          token: data.session?.access_token || '',
          isLoading: false,
        });

        return true;
      }

      // Create user profile in database
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: data.user.id,
            email: data.user.email,
            username,
            trading_mode: 'PAPER',
            account_balance: 10000,
          },
        ])
        .select()
        .single();

      if (profileError) {
        console.error('Erro ao criar perfil:', profileError);
        set({ error: 'Erro ao criar perfil', isLoading: false });
        return false;
      }

      const user: User = {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        trading_mode: profile.trading_mode,
        account_balance: profile.account_balance,
      };

      localStorage.setItem('auth_token', data.session?.access_token || '');
      localStorage.setItem('auth_user', JSON.stringify(user));

      set({
        isAuthenticated: true,
        user,
        token: data.session?.access_token || '',
        isLoading: false,
      });

      return true;
    } catch (err: any) {
      console.error('Erro no signup:', err);
      set({ error: err.message || 'Erro desconhecido', isLoading: false });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    set({ isAuthenticated: false, user: null, token: null, isLoading: false });
  },

  setUser: (user: User) => {
    set({ user });
    localStorage.setItem('auth_user', JSON.stringify(user));
  },

  clearError: () => set({ error: null }),
}));
