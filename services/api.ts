import axios from "axios";

/*
 * Change this if backend is hosted
 * Local: http://localhost:5000
 * Hosted: https://your-backend-url
 */
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

console.log("🚀 API Base URL:", API_BASE_URL);

/* Optional: interceptor for debugging */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error?.response || error.message);
    return Promise.reject(error);
  }
);
