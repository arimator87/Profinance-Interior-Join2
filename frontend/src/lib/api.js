import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pf_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function fileUrl(path) {
  if (!path) return null;
  const token = localStorage.getItem("pf_token");
  return `${API}/files/${path}?auth=${encodeURIComponent(token || "")}`;
}

export function pdfUrl(projectId) {
  const token = localStorage.getItem("pf_token");
  return `${API}/projects/${projectId}/report/pdf?auth=${encodeURIComponent(token || "")}`;
}
