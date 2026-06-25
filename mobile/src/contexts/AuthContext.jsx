import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const loggedIn = await SecureStore.getItemAsync('student_logged_in');
        if (loggedIn === 'true') {
          const userData = await authService.getCurrentUser();
          if (userData && userData.role === 'student') {
            setUser(userData);
          } else {
            await authService.logout();
          }
        }
      } catch (e) {
        console.log('No valid session stored or backend offline', e);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();

    global.onSessionExpired = () => {
      setUser(null);
      SecureStore.deleteItemAsync('student_logged_in').catch(() => {});
    };

    return () => {
      global.onSessionExpired = null;
    };
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const userData = await authService.login(username, password);
      if (userData.role !== 'student') {
        await authService.logout();
        throw new Error('هذا التطبيق مخصص للطلاب فقط.');
      }
      setUser(userData);
      return userData;
    } catch (e) {
      setUser(null);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch (e) {
      console.warn('Logout error', e);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
