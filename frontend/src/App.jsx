import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar.jsx';
import TopHeader from './components/TopHeader.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import PublicLandingPage from './pages/PublicLandingPage.jsx';
import HomePage from './pages/HomePage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import LivePage from './pages/LivePage.jsx';
import MeetingsPage from './pages/MeetingsPage.jsx';
import MeetingDetailPage from './pages/MeetingDetailPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import ActionItemsPage from './pages/ActionItemsPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { Brain } from 'lucide-react';

import SignOutTransition from './components/SignOutTransition';

function AppShell({ children }) {
  return (
    <div className="flex min-h-screen bg-canvas text-text-primary transition-colors duration-150">
      <Navbar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <TopHeader />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function MainAppRoutes() {
  const { user, loading, isSigningOut, completeSignOut } = useAuth();

  if (isSigningOut) {
    return <SignOutTransition onComplete={() => completeSignOut(window.location.replace('/'))} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-canvas text-text-primary p-4">
        <div className="w-12 h-12 rounded-2xl bg-text-primary text-canvas flex items-center justify-center font-extrabold shadow-lg animate-pulse mb-3">
          <Brain size={24} className="text-canvas" />
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono tracking-wider">
          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>LOADING CMIS...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* ── Public auth & landing routes ──────────────────────────────────── */}
      <Route path="/"                 element={user ? <AppShell><HomePage /></AppShell> : <PublicLandingPage />} />
      <Route path="/landing"          element={<PublicLandingPage />} />
      <Route path="/login"            element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register"         element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route path="/verify-email"     element={<VerifyEmailPage />} />
      <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
      <Route path="/reset-password"   element={<ResetPasswordPage />} />

      {/* ── Protected app routes ────────────────────────────────────────── */}
      <Route path="/upload"        element={<ProtectedRoute><AppShell><UploadPage /></AppShell></ProtectedRoute>} />
      <Route path="/live"          element={<ProtectedRoute><AppShell><LivePage /></AppShell></ProtectedRoute>} />
      <Route path="/projects"      element={<ProtectedRoute><AppShell><ProjectsPage /></AppShell></ProtectedRoute>} />
      <Route path="/projects/:id"  element={<ProtectedRoute><AppShell><ProjectDetailPage /></AppShell></ProtectedRoute>} />
      <Route path="/meetings"      element={<ProtectedRoute><AppShell><MeetingsPage /></AppShell></ProtectedRoute>} />
      <Route path="/meetings/:id"  element={<ProtectedRoute><AppShell><MeetingDetailPage /></AppShell></ProtectedRoute>} />
      <Route path="/actions"       element={<ProtectedRoute><AppShell><ActionItemsPage /></AppShell></ProtectedRoute>} />
      <Route path="/insights"      element={<ProtectedRoute><AppShell><InsightsPage /></AppShell></ProtectedRoute>} />
      <Route path="/settings"      element={<ProtectedRoute><AppShell><SettingsPage /></AppShell></ProtectedRoute>} />
      <Route path="*"             element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainAppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
