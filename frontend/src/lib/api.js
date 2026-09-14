import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const res = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
        localStorage.setItem('access_token', res.data.access_token);
        localStorage.setItem('refresh_token', res.data.refresh_token);
        originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
        return api(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  setup2FA: () => api.post('/auth/setup-2fa'),
  verify2FA: (code) => api.post('/auth/verify-2fa', { code }),
  disable2FA: () => api.post('/auth/disable-2fa'),
};

// Users
export const usersApi = {
  list: () => api.get('/users'),
  agents: () => api.get('/users/agents'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Projects
export const projectsApi = {
  list: () => api.get('/projects'),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
};

// Lots
export const lotsApi = {
  list: (projectId, params) => api.get(`/projects/${projectId}/lots`, { params }),
  get: (projectId, lotId) => api.get(`/projects/${projectId}/lots/${lotId}`),
  create: (projectId, data) => api.post(`/projects/${projectId}/lots`, data),
  bulkCreate: (projectId, data) => api.post(`/projects/${projectId}/lots/bulk`, data),
  update: (projectId, lotId, data) => api.put(`/projects/${projectId}/lots/${lotId}`, data),
  delete: (projectId, lotId) => api.delete(`/projects/${projectId}/lots/${lotId}`),
};

// Clients
export const clientsApi = {
  list: (params) => api.get('/clients', { params }),
  get: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
  interactions: (id) => api.get(`/clients/${id}/interactions`),
  addInteraction: (id, data) => api.post(`/clients/${id}/interactions`, data),
};

// Sales
export const salesApi = {
  list: (params) => api.get('/sales', { params }),
  get: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  update: (id, data) => api.put(`/sales/${id}`, data),
  getPaymentPlans: (id) => api.get(`/sales/${id}/payment-plans`),
  registerPayment: (id, data) => api.post(`/sales/${id}/payments`, data),
  quote: (data) => api.post('/sales/quote', data),
};

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  pipeline: () => api.get('/dashboard/pipeline'),
};
