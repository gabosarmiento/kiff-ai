/**
 * Authentication utilities for the frontend
 * This is a basic implementation that should be replaced with your actual auth system
 */

import React, { useState, useEffect, createContext, useContext } from 'react';

export interface User {
  id: string;
  email?: string;
  tenant_id: string;
  token: string;
  is_admin?: boolean;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

// Create context with default values
export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
  loading: true
});

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth on mount
    checkStoredAuth();
  }, []);

  const checkStoredAuth = () => {
    try {
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
      localStorage.removeItem('auth_user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // Replace with your actual login API call
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const userData = await response.json();
      
      // Store user data
      setUser(userData);
      localStorage.setItem('auth_user', JSON.stringify(userData));
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// For development/testing - create a mock user
export const createMockUser = (overrides: Partial<User> = {}): User => {
  return {
    id: 'user_123',
    email: 'test@example.com',
    tenant_id: 'tenant_123',
    token: 'mock_token_123',
    is_admin: false,
    ...overrides
  };
};

// Development helper to set mock user
export const setMockUser = (mockUser?: User) => {
  const user = mockUser || createMockUser();
  localStorage.setItem('auth_user', JSON.stringify(user));
  window.location.reload();
};