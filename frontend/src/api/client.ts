/**
 * Axios HTTP client configured for the backend API.
 *
 * Sets the base URL and adds response interceptors for
 * consistent error handling across all API modules.
 */

import axios from "axios";
import { API_BASE } from "@/shared/constants";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail || error.message || "Unknown error";
    console.error(`API Error [${error.response?.status}]:`, message);
    return Promise.reject(error);
  },
);

export default api;
