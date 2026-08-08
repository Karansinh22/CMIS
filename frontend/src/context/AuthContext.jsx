/**
 * AuthContext.jsx — Global auth state: user, login, logout.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { getMe, clearTokens, getAccessToken } from '../auth';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);   // null = unknown, false = logged out
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setUser(false); setLoading(false); return; }
    getMe()
      .then((r) => setUser(r.data))
      .catch(() => { clearTokens(); setUser(false); })
      .finally(() => setLoading(false));
  }, []);

  const refetchUser = () =>
    getMe().then((r) => setUser(r.data)).catch(() => { clearTokens(); setUser(false); });

  const doLogout = () => { clearTokens(); setUser(false); };

  return (
    <AuthCtx.Provider value={{ user, loading, setUser, doLogout, refetchUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
