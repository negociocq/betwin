import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dqalbolenmsiwapljqjl.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase credentials not configured. Check your .env.local file');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper functions for common operations
export const supabaseHelpers = {
  // Users
  async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async updateUserProfile(userId: string, updates: any) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  // Markets
  async getMarkets() {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .order('updated_at', { ascending: false });
    return { data, error };
  },

  async getMarketById(marketId: string) {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .eq('id', marketId)
      .single();
    return { data, error };
  },

  // Trades
  async getTrades(userId: string) {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async createTrade(trade: any) {
    const { data, error } = await supabase
      .from('trades')
      .insert([trade])
      .select()
      .single();
    return { data, error };
  },

  // Signals
  async getSignals(userId: string) {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'GENERATED')
      .order('generated_at', { ascending: false });
    return { data, error };
  },

  async createSignal(signal: any) {
    const { data, error } = await supabase
      .from('signals')
      .insert([signal])
      .select()
      .single();
    return { data, error };
  },

  // Analytics Cache
  async getAnalyticsCache(marketId: string, selectionId: number) {
    const { data, error } = await supabase
      .from('analytics_cache')
      .select('*')
      .eq('market_id', marketId)
      .eq('selection_id', selectionId);
    return { data, error };
  },

  async upsertAnalyticsCache(analytics: any) {
    const { data, error } = await supabase
      .from('analytics_cache')
      .upsert([analytics])
      .select()
      .single();
    return { data, error };
  },

  // Risk Monitor
  async getRiskMonitor(userId: string) {
    const { data, error } = await supabase
      .from('risk_monitor')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  },

  async updateRiskMonitor(userId: string, updates: any) {
    const { data, error } = await supabase
      .from('risk_monitor')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    return { data, error };
  },

  // Real-time subscriptions
  subscribeToMarkets(callback: any) {
    return supabase
      .channel('markets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'markets' },
        callback
      )
      .subscribe();
  },

  subscribeToTrades(userId: string, callback: any) {
    return supabase
      .channel(`trades:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades', filter: `user_id=eq.${userId}` },
        callback
      )
      .subscribe();
  },
};
