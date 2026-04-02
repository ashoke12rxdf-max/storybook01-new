import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Validate configuration on startup
if (!BACKEND_URL) {
  console.error('[API] REACT_APP_BACKEND_URL is not set! API calls will fail.');
} else {
  console.log('[API] Backend URL configured:', BACKEND_URL);
}

const API = `${BACKEND_URL}/api`;

const getToken = () => localStorage.getItem('admin_token');

// Create axios instance with defaults
const apiClient = axios.create({
  baseURL: API,
  timeout: 30000,
});

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

export const api = {
  login: async (password) => {
    const response = await apiClient.post('/admin/login', { password });
    return response.data;
  },

  uploadStorybook: async (file, title, subtitle) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('subtitle', subtitle);

    const response = await apiClient.post('/storybooks/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${getToken()}`
      }
    });
    return response.data;
  },

  getStorybooks: async (status = null) => {
    try {
      const params = status ? { status } : {};
      const response = await apiClient.get('/storybooks', { params });
      return response.data;
    } catch (error) {
      console.error('[API] Failed to fetch storybooks:', error.message);
      return []; // Return empty array on failure to prevent crashes
    }
  },

  getStorybook: async (id) => {
    const response = await apiClient.get(`/storybooks/${id}`);
    return response.data;
  },

  getStorybookBySlug: async (slug) => {
    const response = await apiClient.get(`/storybooks/slug/${slug}`);
    return response.data;
  },

  updateStorybook: async (id, data) => {
    const response = await apiClient.put(`/storybooks/${id}`, data, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    return response.data;
  },

  deleteStorybook: async (id) => {
    const response = await apiClient.delete(`/storybooks/${id}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    return response.data;
  },

  verifyPassword: async (id, password) => {
    const response = await apiClient.post(`/storybooks/${id}/verify-password`, { password });
    return response.data;
  },

  // ==================== ASSETS API ====================

  // Fonts
  getFonts: async () => {
    const response = await apiClient.get('/assets/fonts');
    return response.data;
  },

  uploadFont: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/assets/fonts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  deleteFont: async (fontId) => {
    const response = await apiClient.delete(`/assets/fonts/${fontId}`);
    return response.data;
  },

  // Sounds
  getSounds: async () => {
    const response = await apiClient.get('/assets/sounds');
    return response.data;
  },

  uploadSound: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/assets/sounds', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  deleteSound: async (soundId) => {
    const response = await apiClient.delete(`/assets/sounds/${soundId}`);
    return response.data;
  },

  // Polar Settings
  getPolarSettings: async () => {
    const response = await apiClient.get('/settings/polar');
    return response.data;
  },

  simulatePolarWebhook: async (data) => {
    const response = await apiClient.post('/automation/simulate-polar-webhook', data);
    return response.data;
  },
};

export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${BACKEND_URL}${path}`;
};
