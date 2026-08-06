/**
 * api.js — Axios client pre-configured for the CMIS FastAPI backend.
 * Base URL reads from VITE_API_URL env var, defaults to localhost:8000.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ── Meetings ─────────────────────────────────────────────────────────────────

export const uploadMeeting = (file, title, onProgress) => {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  return api.post('/meetings/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
};

export const listMeetings = () => api.get('/meetings/');
export const getMeeting   = (id) => api.get(`/meetings/${id}`);
export const getTranscript = (id) => api.get(`/meetings/${id}/transcript`);

// ── Context ───────────────────────────────────────────────────────────────────

export const getContext        = (meetingId)  => api.get(`/context/${meetingId}`);
export const getOpenActionItems = ()           => api.get('/context/action-items/open');
export const patchActionItem   = (id, data)   => api.patch(`/context/action-items/${id}`, data);

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
