import axios from "axios";

/**
 * Production:
 *   VITE_API_BASE_URL = https://attendence-backend-y337.onrender.com
 *
 * Final baseURL becomes:
 *   https://attendence-backend-y337.onrender.com/api
 *
 * Local:
 *   http://localhost:4000/api
 */

const BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "http://localhost:4000/api";

export const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

/**
 * Attach JWT token automatically
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Handle responses globally
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";

    // Don't auto-logout for has-super check
    if (status === 401 && url.includes("/auth/has-super")) {
      return Promise.reject(error);
    }

    // Normal unauthorized handling
    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("adminId");

      window.location.replace("/login");
    }

    return Promise.reject(error);
  }
);
