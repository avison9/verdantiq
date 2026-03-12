import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/authentication/Login";
import Register from "./pages/authentication/Register";
import ForgotPassword from "./pages/authentication/ForgotPassword";
import Verify from "./pages/authentication/Verify";
import ResetPassword from "./pages/authentication/ResetPassword";
import PageNotFound from "./components/PageNotFound";
import PrivateRoute from "./components/PrivateRoute";
import UserProfile from "./pages/profile/UserProfile";
import TenantProfile from "./pages/profile/TenantProfile";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
    ],
  },

  // ── Protected routes ──────────────────────────────────────────────────────
  {
    element: <PrivateRoute />,
    children: [
      {
        path: "/profile/user",
        element: <UserProfile />,
      },
      {
        path: "/profile/tenant",
        element: <TenantProfile />,
      },
    ],
  },

  // ── Auth routes ───────────────────────────────────────────────────────────
  { path: "/login",           element: <Login /> },
  { path: "/register",        element: <Register /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/verify",          element: <Verify /> },
  { path: "/reset-password",  element: <ResetPassword /> },

  { path: "*", element: <PageNotFound /> },
]);
