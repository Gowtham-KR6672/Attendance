// import axios from "axios";

// export const api = axios.create({
//   baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000"
// });

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });
import axios from "axios";

const BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export const api = axios.create({
  baseURL: BASE,           // ✅ includes /api
  withCredentials: true,
});

// ✅ attach token for every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ✅ logout ONLY on 401/403
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";

    // ✅ DO NOT force logout for has-super endpoint
    // (this endpoint is frequently called; after logout it will be 401)
    if (status === 401 && url.includes("/auth/has-super")) {
      return Promise.reject(err);
    }

    // ✅ Normal 401 handling
    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("adminId");
      window.location.replace("/login");  // replace avoids back-loop
    }

    return Promise.reject(err);
  }
);


