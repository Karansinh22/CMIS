/**
 * SettingsPage.jsx — User Account & Security Settings.
 * Clean, production-grade monochrome interface.
 */
import { useState, useEffect } from 'react';
import { User, Shield, Key, CheckCircle, Save, Lock, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, updateProfile, changePassword } from '../api';
import { logout } from '../auth';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { user, updateUser, executeSignOut } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security'
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
    await executeSignOut();
    navigate('/', { replace: true });
  };

  const initials = profileData.name
    ? profileData.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.name ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U');

  return (
    <div className="page-wrapper max-w-3xl space-y-6 py-8">
      {/* Page Header */}
      <div>
        <h1 className="page-title text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight">Account Settings</h1>
        <p className="page-subtitle text-sm text-text-secondary mt-1">Manage your account profile, credentials, and active sessions.</p>
      </div>

      {/* Tabs Header */}
      <div className="tab-bar max-w-md">
        <button
          onClick={() => setActiveTab('profile')}
          className={activeTab === 'profile' ? 'tab-btn-active' : 'tab-btn-inactive'}
        >
          <User size={15} />
          <span>Profile Details</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={activeTab === 'security' ? 'tab-btn-active' : 'tab-btn-inactive'}
        >
          <Shield size={15} />
          <span>Security &amp; Password</span>
        </button>
      </div>

      {/* Tab 1: Profile Details */}
      {activeTab === 'profile' && (
        <div className="card p-6 md:p-8 space-y-6">
          {/* Avatar Header */}
          <div className="flex items-center gap-4 pb-5 border-b border-border-subtle">
            <div className="w-16 h-16 rounded-xl bg-surface-hover border border-border-default flex items-center justify-center text-text-primary text-xl font-extrabold shadow-sm">
              {initials}
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-primary">{profileData.name || user?.name || 'User Profile'}</h3>
              <p className="text-text-secondary text-sm">{profileData.email || user?.email}</p>
              <div className="pt-1">
                <span className="badge badge-success text-xs py-0.5 px-2.5">
                  <CheckCircle size={12} /> Verified Account
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <div>
              <label className="label text-xs">Full Name</label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="input text-sm"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="label text-xs">Email Address</label>
              <input
                type="email"
                disabled
                value={profileData.email || user?.email || ''}
                className="input text-sm bg-surface-hover opacity-70 cursor-not-allowed"
              />
              <p className="text-xs text-text-muted mt-1.5">Email address is tied to your verified login credentials.</p>
            </div>

            {profileMsg.text && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold ${
                profileMsg.type === 'success'
                  ? 'bg-semantic-success/10 text-semantic-success border border-semantic-success/20'
                  : 'bg-semantic-error/10 text-semantic-error border border-semantic-error/20'
              }`}>
                {profileMsg.text}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={savingProfile} className="btn-primary text-sm py-2.5 px-5">
                <Save size={15} />
                <span>{savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="card p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-text-primary pb-4 border-b border-border-subtle">
              <Key size={16} />
              <h3>Change Password</h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="label text-xs">Current Password</label>
                <input
                  type="password"
                  required
                  value={pwdForm.current_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                  className="input text-sm"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs">New Password</label>
                  <input
                    type="password"
                    required
                    value={pwdForm.new_password}
                    onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                    className="input text-sm"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="label text-xs">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={pwdForm.confirm_password}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })}
                    className="input text-sm"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              {pwdMsg.text && (
                <div className={`p-3.5 rounded-xl text-xs font-semibold ${
                  pwdMsg.type === 'success'
                    ? 'bg-semantic-success/10 text-semantic-success border border-semantic-success/20'
                    : 'bg-semantic-error/10 text-semantic-error border border-semantic-error/20'
                }`}>
                  {pwdMsg.text}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={changingPwd} className="btn-primary text-sm py-2.5 px-5">
                  <Lock size={15} />
                  <span>{changingPwd ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Session Card */}
          <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">Active Session</h4>
              <p className="text-xs text-text-secondary mt-1">Authenticated JWT session active on this browser.</p>
            </div>

            <button
              onClick={handleLogout}
              className="btn-danger text-xs py-2.5 px-4 self-start sm:self-auto font-bold"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
