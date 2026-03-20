/**
 * Authentication types.
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  phone?: string;
  company_name?: string;
  industry?: string;
  interests?: string[];
  is_active: boolean;
  is_superuser?: boolean;
  is_promoter?: boolean;
  role?: string;
  user_type?: string;
  tier?: string | null;
  segment_groups?: string[];
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  name?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
