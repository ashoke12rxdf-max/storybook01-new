import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Auto-authenticate - admin access is open
  const [isAuthenticated] = useState(true);
  const [token] = useState('auto-auth');

  useEffect(() => {
    // Keep localStorage token for any legacy components that check it
    localStorage.setItem('admin_token', 'auto-auth');
  }, []);

  const login = () => {
    // No-op since always authenticated
  };

  const logout = () => {
    // No-op since no password required
  };

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
