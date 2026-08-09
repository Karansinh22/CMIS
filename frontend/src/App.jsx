import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import HomePage from './pages/HomePage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import MeetingsPage from './pages/MeetingsPage.jsx';
import MeetingDetailPage from './pages/MeetingDetailPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import ActionItemsPage from './pages/ActionItemsPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function AppShell({ children }) {
  return (
    <div className="flex min-h-screen bg-surface">
      {/* Ambient background layers */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Primary glow */}
        <div className="glow-orb w-[600px] h-[600px] bg-brand-600/20 -top-48 -left-48 opacity-40" />
        {/* Secondary accent */}
        <div className="glow-orb w-80 h-80 bg-purple-600/15 top-1/2 -right-24 opacity-25" />
        {/* Cyan accent */}
        <div className="glow-orb w-64 h-64 bg-cyan-500/10 bottom-10 left-1/3 opacity-20" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        {/* Top gradient fade */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />
      </div>
      <Navbar />
      <main className="flex-1 relative z-10 overflow-auto min-h-screen">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* ── Public auth routes ──────────────────────────────────────────── */}
          <Route path="/login"            element={<LoginPage />} />
          <Route path="/register"         element={<RegisterPage />} />
          <Route path="/verify-email"     element={<VerifyEmailPage />} />
          <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
          <Route path="/reset-password"   element={<ResetPasswordPage />} />

          {/* ── Protected app routes ────────────────────────────────────────── */}
          <Route path="/*" element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  <Route path="/"              element={<HomePage />} />
                  <Route path="/upload"        element={<UploadPage />} />
                  <Route path="/projects"      element={<ProjectsPage />} />
                  <Route path="/projects/:id"  element={<ProjectDetailPage />} />
                  <Route path="/meetings"      element={<MeetingsPage />} />
                  <Route path="/meetings/:id"  element={<MeetingDetailPage />} />
                  <Route path="/actions"       element={<ActionItemsPage />} />
                  <Route path="/insights"      element={<InsightsPage />} />
                  <Route path="/settings"      element={<SettingsPage />} />
                  <Route path="*"             element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
