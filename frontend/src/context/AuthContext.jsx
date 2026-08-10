/**
 * AuthContext.jsx — Global auth state: user, login, logout, and sign-out animation.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { getMe, clearTokens, getAccessToken, logout as apiLogout } from '../auth';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // null = loading, false = logged out, Object = user
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }
    getMe()
      .then((r) => setUser(r.data))
      .catch(() => {
        clearTokens();
        setUser(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const refetchUser = async () => {
    try {
      const res = await getMe();
      setUser(res.data);
      return res;
    } catch {
      clearTokens();
      setUser(false);
      return null;
    }
  };

  const updateUser = (data) => {
    setUser((prev) => (prev ? { ...prev, ...data } : data));
  };

  const doLogout = () => {
    clearTokens();
    setUser(false);
  };

  const executeSignOut = async (navigate) => {
    setIsSigningOut(true);
    try {
      await apiLogout();
    } catch {
      /* ignore api logout errors safely */
    } finally {
      clearTokens();
      setUser(false);
    }
  };

  const completeSignOut = (navigate) => {
    setIsSigningOut(false);
    if (navigate) {
      navigate('/', { replace: true });
    }
  };

  return (
    <AuthCtx.Provider value={{
      user,
      loading,
      isSigningOut,
      setUser,
      updateUser,
      doLogout,
      executeSignOut,
      completeSignOut,
      refetchUser
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
