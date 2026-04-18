import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ServiceStaff } from '@/types/database';

interface AuthContextType {
  user: ServiceStaff | null;
  login: (user: ServiceStaff) => void;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ServiceStaff | null>(null);

  useEffect(() => {
    // 从 localStorage 恢复登录状态
    const savedUser = localStorage.getItem('service_staff');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('service_staff');
      }
    }
  }, []);

  const login = (userData: ServiceStaff) => {
    setUser(userData);
    localStorage.setItem('service_staff', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('service_staff');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
