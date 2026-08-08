import { useState, useEffect } from 'react';
import { User, Shield, Key, CheckCircle, AlertCircle, Save, Lock, LogOut, Cpu, HardDrive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, updateProfile, changePassword } from '../api';
import { logout } from '../auth';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { user, updateUser, doLogout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'system'
  const [profileData, setProfileData] = useState({ name: '', email: '', email_verified: false, created_at: '' });
  const [loading, setLoading] = useState(true);

  // Profile update state
  const [nameInput, setNameInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Password change state
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });

  const loadProfile = async () => {
    try {
      const { data } = await getUserProfile();
      setProfileData(data);
      setNameInput(data.name || '');
    } catch (err) {
      console.error('Failed to load user profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSavingProfile(true);
    setProfileMsg({ type: '', text: '' });

    try {
      const { data } = await updateProfile(nameInput.trim());
      setProfileData(data);
      updateUser(data);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg({ type: '', text: '' });

    if (pwdForm.new_password !== pwdForm.confirm_password) {
      setPwdMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    if (pwdForm.new_password.length < 8) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }

    setChangingPwd(true);
    try {
      await changePassword(pwdForm.current_password, pwdForm.new_password);
      setPwdMsg({ type: 'success', text: 'Password changed successfully!' });
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to change password.' });
    } finally {
      setChangingPwd(false);
    }
  };

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore */ }
    doLogout();
    navigate('/login');
  };

  const initials = profileData.name
    ? profileData.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Account Settings & Profile</h1>
        <p className="text-white/40 text-sm mt-1">Manage your account details, security credentials, and system preferences.</p>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'profile' ? 'border-brand-500 text-brand-300' : 'border-transparent text-white/40 hover:text-white'
          }`}
        >
          <User size={16} /> Profile Details
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'security' ? 'border-brand-500 text-brand-300' : 'border-transparent text-white/40 hover:text-white'
          }`}
        >
          <Shield size={16} /> Security & Password
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'system' ? 'border-brand-500 text-brand-300' : 'border-transparent text-white/40 hover:text-white'
          }`}
        >
          <Cpu size={16} /> System Info
        </button>
      </div>

      {/* Tab 1: Profile Details */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
            {/* Avatar header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center text-white text-xl font-bold shadow-glow-brand">
                {initials}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{profileData.name || 'User Profile'}</h3>
                <p className="text-white/40 text-xs">{profileData.email}</p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <CheckCircle size={12} />
                  Verified Email Account
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4 pt-4 border-t border-white/5">
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={profileData.email}
                  className="input bg-white/5 text-white/40 cursor-not-allowed"
                />
                <p className="text-[11px] text-white/30 mt-1">Email address is verified and tied to your account identity.</p>
              </div>

              {profileMsg.text && (
                <div className={`p-3 rounded-xl text-xs ${profileMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                  {profileMsg.text}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={savingProfile} className="btn-primary text-xs py-2.5 px-5 gap-2">
                  <Save size={14} />
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="flex items-center gap-2 text-brand-300 font-semibold text-sm">
              <Key size={18} />
              <h3>Change Account Password</h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={pwdForm.current_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/60 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={pwdForm.new_password}
                    onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                    className="input"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/60 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={pwdForm.confirm_password}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })}
                    className="input"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              {pwdMsg.text && (
                <div className={`p-3 rounded-xl text-xs ${pwdMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                  {pwdMsg.text}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={changingPwd} className="btn-primary text-xs py-2.5 px-5 gap-2">
                  <Lock size={14} />
                  {changingPwd ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Session Management */}
          <div className="glass p-6 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">Active Session</h4>
              <p className="text-xs text-white/40 mt-0.5">Signed in on this browser with JWT authentication tokens.</p>
            </div>

            <button onClick={handleLogout} className="px-4 py-2 rounded-xl text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-2">
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: System Info */}
      {activeTab === 'system' && (
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <HardDrive size={18} className="text-brand-400" />
            CMIS Local Engine Architecture
          </h3>
          <div className="space-y-2 text-xs text-white/60">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex justify-between">
              <span>Backend API Server</span>
              <span className="text-emerald-400 font-medium">FastAPI v0.100.0 (Python 3.10)</span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex justify-between">
              <span>Speech-to-Text Model</span>
              <span className="text-brand-300 font-medium">Whisper (Base)</span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex justify-between">
              <span>LSH Vector Store</span>
              <span className="text-purple-300 font-medium">MinHash LSH Index (128 Permutations)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
