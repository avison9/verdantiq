// In dev (no VITE_API_BASE_URL set), use "" so Vite's dev proxy intercepts.
// In production builds, set VITE_API_BASE_URL to the real backend URL.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const APIendPoints = {
  baseUrl: BASE_URL,
  // Auth
  register: "register",
  login: "login",
  logout: "logout",
  forgotPassword: "forgot-password",
  resetPassword: "reset-password",
  // Users
  me: "users/me",
  // Sensors
  sensors: "sensors",
  // Billing
  billings: "billings",
};
