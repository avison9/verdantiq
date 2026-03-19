import { createBrowserRouter, Navigate } from "react-router-dom";
import MarketingLayout from "./components/MarketingLayout";
import DashboardLayout from "./components/DashboardLayout";
import LandingPage from "./pages/LandingPage";
import AboutUs from "./pages/marketing/AboutUs";
import MissionVision from "./pages/marketing/MissionVision";
import ContactUs from "./pages/marketing/ContactUs";
import Pricing from "./pages/marketing/Pricing";
import Dashboard from "./pages/Dashboard";
import OnboardSensor from "./pages/sensors/OnboardSensor";
import SensorList from "./pages/sensors/SensorList";
import SensorDetail from "./pages/sensors/SensorDetail";
import SensorAudit from "./pages/sensors/SensorAudit";
import SensorConnections from "./pages/sensors/SensorConnections";
import SensorConnectionDetail from "./pages/sensors/SensorConnectionDetail";
import SetupBilling from "./pages/billing/SetupBilling";
import Transactions from "./pages/billing/Transactions";
import SensorBudget from "./pages/billing/SensorBudget";
import AnalyticsOverview from "./pages/analytics/AnalyticsOverview";
import AnalyticsAI from "./pages/analytics/AnalyticsAI";
import StorageOverview from "./pages/storage/StorageOverview";
import FarmAdd from "./pages/farm/FarmAdd";
import FarmList from "./pages/farm/FarmList";
import FarmDetail from "./pages/farm/FarmDetail";
import CropManagementList from "./pages/farm/CropManagementList";
import CropDetail from "./pages/farm/CropDetail";
import RunningCostDetail from "./pages/billing/RunningCostDetail";
import Team from "./pages/team/Team";
import StorageAdd from "./pages/storage/StorageAdd";
import StorageList from "./pages/storage/StorageList";
import StorageQuery from "./pages/storage/StorageQuery";
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
  // ── Marketing shell ────────────────────────────────────────────────────────
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

  // ── Protected routes (all share DashboardLayout sidebar) ──────────────────
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: "/dashboard",                            element: <Dashboard /> },
          { path: "/sensors/onboard",                      element: <OnboardSensor /> },
          { path: "/sensors/list",                         element: <SensorList /> },
          { path: "/sensors/connections",                  element: <SensorConnections /> },
          { path: "/sensors/audit",                        element: <SensorAudit /> },
          { path: "/sensors/:sensorId/connection",         element: <SensorConnectionDetail /> },
          { path: "/sensors/:sensorId",                    element: <SensorDetail /> },
          { path: "/billing/setup",                        element: <SetupBilling /> },
          { path: "/billing/transactions",                 element: <Transactions /> },
          { path: "/billing/budget",                       element: <SensorBudget /> },
          // Farm sub-pages
          { path: "/farm/add",                             element: <FarmAdd /> },
          { path: "/farm/management",                      element: <FarmList /> },
          { path: "/farm/crops",                           element: <CropManagementList /> },
          { path: "/farm/crops/:cropId",                   element: <CropDetail /> },
          { path: "/farm/:farmId",                         element: <FarmDetail /> },
          // Analytics sub-pages
          { path: "/analytics",                            element: <Navigate to="/analytics/overview" replace /> },
          { path: "/analytics/overview",                   element: <AnalyticsOverview /> },
          { path: "/analytics/ai",                         element: <AnalyticsAI /> },
          // Billing detail
          { path: "/billing/running-cost",                 element: <RunningCostDetail /> },
          // Storage sub-pages
          { path: "/storage",                              element: <Navigate to="/storage/overview" replace /> },
          { path: "/storage/overview",                     element: <StorageOverview /> },
          { path: "/storage/add",                          element: <StorageAdd /> },
          { path: "/storage/list",                         element: <StorageList /> },
          { path: "/storage/connections",                  element: <Navigate to="/storage/overview" replace /> },
          // Query moved to Analytics
          { path: "/analytics/query",                      element: <StorageQuery /> },
          { path: "/storage/query",                        element: <Navigate to="/analytics/query" replace /> },
          { path: "/team",                                 element: <Team /> },
          { path: "/profile/user",                         element: <UserProfile /> },
          { path: "/profile/tenant",                       element: <TenantProfile /> },
        ],
      },
    ],
  },

  // ── Auth routes ────────────────────────────────────────────────────────────
  { path: "/login",           element: <Login /> },
  { path: "/register",        element: <Register /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/verify",          element: <Verify /> },
  { path: "/reset-password",  element: <ResetPassword /> },

  { path: "*", element: <PageNotFound /> },
]);
