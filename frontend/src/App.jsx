import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
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
      {/* Decorative ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="glow-orb w-96 h-96 bg-brand-600 -top-32 -left-32" />
        <div className="glow-orb w-72 h-72 bg-purple-600 top-1/2 -right-20 opacity-10" />
        <div className="glow-orb w-64 h-64 bg-cyan-500 bottom-0 left-1/3 opacity-10" />
      </div>
      <Navbar />
      <main className="flex-1 relative z-10 overflow-auto">{children}</main>
    </div>
  );
}

export default function App() {
  return (
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
                <Route path="/"              element={<UploadPage />} />
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
  );
}
