/**
 * auth.js — Auth-aware Axios client and API helpers.
 */
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Storage helpers ───────────────────────────────────────────────────────────
export const getAccessToken  = () => localStorage.getItem('cmis_access_token');
export const getRefreshToken = () => localStorage.getItem('cmis_refresh_token');
export const saveTokens      = (access, refresh) => {
  localStorage.setItem('cmis_access_token',  access);
  localStorage.setItem('cmis_refresh_token', refresh);
};
export const clearTokens = () => {
  localStorage.removeItem('cmis_access_token');
  localStorage.removeItem('cmis_refresh_token');
};

// ── Axios instance ────────────────────────────────────────────────────────────
export const authApi = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// Inject access token into every request
authApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
authApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = getRefreshToken();
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
          saveTokens(data.access_token, data.refresh_token);
          original.headers['Authorization'] = `Bearer ${data.access_token}`;
          return authApi(original);
        } catch {
          clearTokens();
          window.location.href = '/login';
        }
      } else {
        clearTokens();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth API calls ────────────────────────────────────────────────────────────
export const register      = (name, email, password)      => authApi.post('/auth/register',       { name, email, password });
export const verifyEmail   = (email, otp)                  => authApi.post('/auth/verify-email',   { email, otp });
export const resendOTP     = (email)                       => authApi.post('/auth/resend-otp',     { email });
export const login         = (email, password)             => authApi.post('/auth/login',          { email, password });
export const logout        = ()                            => authApi.post('/auth/logout');
export const forgotPassword = (email)                      => authApi.post('/auth/forgot-password',{ email });
export const resetPassword  = (email, otp, new_password)   => authApi.post('/auth/reset-password', { email, otp, new_password });
export const getMe         = ()                            => authApi.get('/auth/me');
