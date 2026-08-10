/**
 * SettingsPage.jsx — User Account, Security, & System Configuration.
 * Strict enterprise monochrome UI.
 */
import { useState, useEffect } from 'react';
import { User, Shield, Key, CheckCircle, Save, Lock, LogOut, Cpu, HardDrive } from 'lucide-react';
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
      setProfileData(data || {});
      setNameInput(data?.name || '');
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
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
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
      setPwdMsg({ type: 'success', text: 'Password changed successfully.' });
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
    navigate('/');
  };

  const initials = profileData.name
    ? profileData.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="page-wrapper max-w-3xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="page-title text-2xl font-extrabold">Account Settings</h1>
        <p className="page-subtitle text-xs">Manage your profile credentials, authentication, and engine preferences.</p>
      </div>

      {/* Tabs Header */}
      <div className="tab-bar">
        <button
          onClick={() => setActiveTab('profile')}
          className={activeTab === 'profile' ? 'tab-btn-active' : 'tab-btn-inactive'}
        >
          <User size={13} />
          <span>Profile</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={activeTab === 'security' ? 'tab-btn-active' : 'tab-btn-inactive'}
        >
          <Shield size={13} />
          <span>Security &amp; Password</span>
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={activeTab === 'system' ? 'tab-btn-active' : 'tab-btn-inactive'}
        >
          <Cpu size={13} />
          <span>System Engine</span>
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="card p-6 space-y-6">
          {/* Avatar Header */}
          <div className="flex items-center gap-4 pb-4 border-b border-border-subtle">
            <div className="w-14 h-14 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-text-primary text-lg font-bold">
              {initials}
            </div>
            <div className="space-y-0.5">
              <h3 className="text-base font-bold text-text-primary">{profileData.name || 'User Profile'}</h3>
              <p className="text-text-muted text-xs">{profileData.email}</p>
              <div className="pt-1">
                <span className="badge badge-success text-[10px]">
                  <CheckCircle size={10} /> Verified Account
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="input text-xs"
              />
            </div>

            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                disabled
                value={profileData.email || ''}
                className="input text-xs bg-surface-hover opacity-70 cursor-not-allowed"
              />
              <p className="text-[11px] text-text-muted mt-1">Email is locked to your account credentials.</p>
            </div>

            {profileMsg.text && (
              <div className={`p-3 rounded text-xs ${
                profileMsg.type === 'success'
                  ? 'bg-semantic-success/10 text-semantic-success border border-semantic-success/20'
                  : 'bg-semantic-error/10 text-semantic-error border border-semantic-error/20'
              }`}>
                {profileMsg.text}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={savingProfile} className="btn-primary text-xs py-2 px-4">
                <Save size={13} />
                <span>{savingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-primary pb-3 border-b border-border-subtle">
              <Key size={14} />
              <h3>Change Password</h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <input
                  type="password"
                  required
                  value={pwdForm.current_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                  className="input text-xs"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    required
                    value={pwdForm.new_password}
                    onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                    className="input text-xs"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={pwdForm.confirm_password}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })}
                    className="input text-xs"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              {pwdMsg.text && (
                <div className={`p-3 rounded text-xs ${
                  pwdMsg.type === 'success'
                    ? 'bg-semantic-success/10 text-semantic-success border border-semantic-success/20'
                    : 'bg-semantic-error/10 text-semantic-error border border-semantic-error/20'
                }`}>
                  {pwdMsg.text}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={changingPwd} className="btn-primary text-xs py-2 px-4">
                  <Lock size={13} />
                  <span>{changingPwd ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Session Management */}
          <div className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Active Authentication Session</h4>
              <p className="text-xs text-text-secondary mt-0.5">Secure JWT authentication stored on this browser.</p>
            </div>

            <button
              onClick={handleLogout}
              className="btn-danger text-xs py-2 px-3.5 self-start sm:self-auto"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: System Engine */}
      {activeTab === 'system' && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-primary pb-3 border-b border-border-subtle">
            <HardDrive size={14} />
            <h3>CMIS Local Intelligence Engine</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-lg bg-surface-hover border border-border-subtle flex justify-between items-center">
              <span className="text-text-secondary">Backend API Server</span>
              <span className="font-semibold text-text-primary">FastAPI (Python 3.10)</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-hover border border-border-subtle flex justify-between items-center">
              <span className="text-text-secondary">Speech Diarization &amp; Transcription</span>
              <span className="font-semibold text-text-primary">Whisper (Base)</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-hover border border-border-subtle flex justify-between items-center">
              <span className="text-text-secondary">Locality-Sensitive Hashing Index</span>
              <span className="font-semibold text-text-primary">MinHash LSH (128 Permutations)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
