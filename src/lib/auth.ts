// src/lib/auth.ts
import { supabase } from './supabase';

export interface User {
  id: string;
  email?: string;
  full_name?: string;
  role?: string;
}

class AuthService {
  private currentUser: User | null = null;

  async init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        this.currentUser = {
          id: user.id,
          email: user.email,
          full_name: profile.full_name,
          role: profile.role
        };
      }
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async signOut() {
    await supabase.auth.signOut();
    this.currentUser = null;
  }
}

export const authService = new AuthService();
