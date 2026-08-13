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

      // Fetch user profile from database by email instead of id
      const { data: profiles, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email);

      let profile = null;
      if (!profileError && profiles && profiles.length > 0) {
        profile = profiles[0];
      }

      if (!profile) {
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
          // Se o erro é por constraint (email já existe), buscar o perfil existente
          if (createError.code === '23505') {
            console.log('Email já existe, buscando perfil existente...');
            const { data: existingProfiles } = await supabase
              .from('users')
              .select('*')
              .eq('email', email);

            if (existingProfiles && existingProfiles.length > 0) {
              profile = existingProfiles[0];
            } else {
              set({ error: 'Perfil não encontrado', isLoading: false });
              return false;
            }
          } else {
            console.error('Erro ao criar perfil:', createError);
            set({ error: 'Erro ao criar perfil', isLoading: false });
            return false;
          }
        } else {
          profile = newProfile;
        }
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

      // Check if profile already exists by email
      const { data: existingProfiles } = await supabase
        .from('users')
        .select('*')
        .eq('email', email);

      let profile = null;

      // If profile exists, use it
      if (existingProfiles && existingProfiles.length > 0) {
        profile = existingProfiles[0];
      } else {
        // Create user profile in database
        const { data: newProfile, error: profileError } = await supabase
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
          // If error is constraint, fetch the existing profile
          if (profileError.code === '23505') {
            const { data: foundProfiles } = await supabase
              .from('users')
              .select('*')
              .eq('email', email);

            if (foundProfiles && foundProfiles.length > 0) {
              profile = foundProfiles[0];
            } else {
              console.error('Erro ao criar perfil:', profileError);
              set({ error: 'Erro ao criar perfil', isLoading: false });
              return false;
            }
          } else {
            console.error('Erro ao criar perfil:', profileError);
            set({ error: 'Erro ao criar perfil', isLoading: false });
            return false;
          }
        } else {
          profile = newProfile;
        }
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
