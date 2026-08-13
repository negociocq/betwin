import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    'Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper functions for common operations

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    return false;
  }
  return true;
}

// Trades operations
export async function getTrades(userId: string) {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching trades:', error);
    return [];
  }
  return data || [];
}

export async function createTrade(trade: any) {
  const { data, error } = await supabase
    .from('trades')
    .insert([trade])
    .select()
    .single();

  if (error) {
    console.error('Error creating trade:', error);
    return null;
  }
  return data;
}

// Markets operations
export async function getMarkets() {
  const { data, error } = await supabase
    .from('markets')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching markets:', error);
    return [];
  }
  return data || [];
}

export async function getMarket(marketId: string) {
  const { data, error } = await supabase
    .from('markets')
    .select('*')
    .eq('id', marketId)
    .single();

  if (error) {
    console.error('Error fetching market:', error);
    return null;
  }
  return data;
}

// Signals operations
export async function getSignals(userId: string) {
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false });

  if (error) {
    console.error('Error fetching signals:', error);
    return [];
  }
  return data || [];
}

export async function createSignal(signal: any) {
  const { data, error } = await supabase
    .from('signals')
    .insert([signal])
    .select()
    .single();

  if (error) {
    console.error('Error creating signal:', error);
    return null;
  }
  return data;
}

// Risk Monitor operations
export async function getRiskMonitor(userId: string) {
  const { data, error } = await supabase
    .from('risk_monitor')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching risk monitor:', error);
    return null;
  }
  return data;
}

export async function updateRiskMonitor(userId: string, updates: any) {
  const { data, error } = await supabase
    .from('risk_monitor')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating risk monitor:', error);
    return null;
  }
  return data;
}

// Real-time subscriptions
export function subscribeToTrades(userId: string, callback: (payload: any) => void) {
  return supabase
    .from(`trades:user_id=eq.${userId}`)
    .on('*', (payload) => callback(payload))
    .subscribe();
}

export function subscribeToSignals(userId: string, callback: (payload: any) => void) {
  return supabase
    .from(`signals:user_id=eq.${userId}`)
    .on('*', (payload) => callback(payload))
    .subscribe();
}
