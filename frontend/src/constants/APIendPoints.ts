const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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
  billingTopup: "billings/topup",
  billingTransactions: "billings/transactions",
};
