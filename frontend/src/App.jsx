import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import UploadPage from './pages/UploadPage.jsx';
import MeetingsPage from './pages/MeetingsPage.jsx';
import MeetingDetailPage from './pages/MeetingDetailPage.jsx';
import ActionItemsPage from './pages/ActionItemsPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen bg-surface">
      {/* Decorative ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="glow-orb w-96 h-96 bg-brand-600 -top-32 -left-32" />
        <div className="glow-orb w-72 h-72 bg-purple-600 top-1/2 -right-20 opacity-10" />
        <div className="glow-orb w-64 h-64 bg-cyan-500 bottom-0 left-1/3 opacity-10" />
      </div>

      <Navbar />

      <main className="flex-1 relative z-10 overflow-auto">
        <Routes>
          <Route path="/"                   element={<UploadPage />} />
          <Route path="/meetings"           element={<MeetingsPage />} />
          <Route path="/meetings/:id"       element={<MeetingDetailPage />} />
          <Route path="/actions"            element={<ActionItemsPage />} />
          <Route path="/insights"           element={<InsightsPage />} />
        </Routes>
      </main>
    </div>
  );
}
