/**
 * api.js — Axios client pre-configured for the CMIS FastAPI backend.
 * Uses auth token from localStorage if available.
 */

import axios from 'axios';
import { getAccessToken } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Inject token into requests
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ── Auth & Profile ────────────────────────────────────────────────────────────

export const getUserProfile = () => api.get('/auth/me');
export const updateProfile  = (name) => api.patch('/auth/me', { name });
export const changePassword = (current_password, new_password) =>
  api.post('/auth/change-password', { current_password, new_password });

// ── Projects ─────────────────────────────────────────────────────────────────

export const createProject = (data) => api.post('/projects', data);
export const listProjects  = ()     => api.get('/projects');
export const getProject   = (id)   => api.get(`/projects/${id}`);
export const deleteProject = (id)   => api.delete(`/projects/${id}`);
export const synthesizeProject = (id) => api.post(`/projects/${id}/synthesize`);

export const uploadProjectMeeting = (projectId, file, title, onProgress) => {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  return api.post(`/projects/${projectId}/meetings/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
};

// ── Meetings & Transcripts ────────────────────────────────────────────────────

export const uploadMeeting = (file, title, projectOptions = {}, onProgress) => {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);

  if (projectOptions.summaryType) {
    form.append('summary_type', projectOptions.summaryType);
  }

  if (projectOptions.projectId) {
    form.append('project_id', projectOptions.projectId);
  } else if (projectOptions.newProjectName) {
    form.append('new_project_name', projectOptions.newProjectName);
    if (projectOptions.newProjectCompany) form.append('new_project_company', projectOptions.newProjectCompany);
    if (projectOptions.newProjectCategory) form.append('new_project_category', projectOptions.newProjectCategory);
  }

  return api.post('/meetings/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
};

export const listMeetings = () => api.get('/meetings/');
export const createLiveMeeting = (data) => api.post('/meetings/live', data);
export const getMeeting   = (id) => api.get(`/meetings/${id}`);
export const deleteMeeting = (id) => api.delete(`/meetings/${id}`);
export const getTranscript = (id) => api.get(`/meetings/${id}/transcript`);

export const editTranscriptSegment = (meetingId, segmentId, newText) =>
  api.patch(`/meetings/${meetingId}/transcript/${segmentId}`, { new_text: newText });

export const getTranscriptHistory = (meetingId) =>
  api.get(`/meetings/${meetingId}/transcript/history`);

// ── Context ───────────────────────────────────────────────────────────────────

export const getContext        = (meetingId)  => api.get(`/context/${meetingId}`);
export const getOpenActionItems = ()           => api.get('/context/action-items/open');
export const patchActionItem   = (id, data)   => api.patch(`/context/action-items/${id}`, data);
export const createActionItem  = (meetingId, data) => api.post(`/context/${meetingId}/action-items`, data);
export const deleteActionItem  = (id)          => api.delete(`/context/action-items/${id}`);
export const createDecision    = (meetingId, data) => api.post(`/context/${meetingId}/decisions`, data);
export const deleteDecision    = (id)          => api.delete(`/context/decisions/${id}`);

// ── Insights ──────────────────────────────────────────────────────────────────

export const getRecurringTopics = () => api.get('/insights/recurring-topics');
export const getOverdueItems    = () => api.get('/insights/action-items/overdue');

// ── WebSocket ─────────────────────────────────────────────────────────────────

export const wsBaseUrl = BASE_URL.replace(/^http/, 'ws');

export const openStatusSocket = (meetingId, onMessage, onError) => {
  const ws = new WebSocket(`${wsBaseUrl}/ws/status/${meetingId}`);
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onerror   = onError || (() => {});
  return ws;
};
