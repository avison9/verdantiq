import { createBrowserRouter } from "react-router-dom";
import MarketingLayout from "./components/MarketingLayout";
import LandingPage from "./pages/LandingPage";
import AboutUs from "./pages/marketing/AboutUs";
import MissionVision from "./pages/marketing/MissionVision";
import ContactUs from "./pages/marketing/ContactUs";
import Pricing from "./pages/marketing/Pricing";
import Dashboard from "./pages/Dashboard";
import OnboardSensor from "./pages/sensors/OnboardSensor";
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
  // ── Marketing shell (transparent nav + rich footer) ────────────────────────
  {
    element: <MarketingLayout />,
    children: [
      { path: "/",        element: <LandingPage /> },
      { path: "/about",   element: <AboutUs /> },
      { path: "/mission", element: <MissionVision /> },
      { path: "/contact", element: <ContactUs /> },
      { path: "/pricing", element: <Pricing /> },
    ],
  },

  // ── Protected routes (dashboard has its own top bar) ───────────────────────
  {
    element: <PrivateRoute />,
    children: [
      { path: "/dashboard",        element: <Dashboard /> },
      { path: "/sensors/onboard",  element: <OnboardSensor /> },
      { path: "/profile/user",     element: <UserProfile /> },
      { path: "/profile/tenant",   element: <TenantProfile /> },
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
