import axios from 'axios';
import './axios-setup';

/** Same-origin /api/* (Next rewrite) keeps httpOnly auth cookie on login. Set NEXT_PUBLIC_API_URL only for direct API access. */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return Promise.reject(error);
  },
);

export default api;