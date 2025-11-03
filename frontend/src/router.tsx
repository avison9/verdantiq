import { createBrowserRouter } from "react-router-dom";
import App from "./App";

// import ForgotPassword from "./pages/authentication/ForgotPassword";
// import Verify from "./pages/authentication/Verify";
// import ResetPassword from "./pages/authentication/ResetPassword";
import PageNotFound from "./components/PageNotFound";
// import Login from "./pages/authentication/Login";
import { lazy } from "react";

const Login = lazy(() => import("./pages/authentication/Login"));
const PrivateRoute = lazy(() => import("./components/PrivateRoute"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const FarmerRegistrationForm = lazy(
  () => import("./pages/authentication/FarmerRegistrationForm")
);
const WorkerRegistrationForm = lazy(
  () => import("./pages/authentication/WorkerRegistrationForm")
);
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const UpdateProfilePage = lazy(() => import("./pages/dashboard/UpdateProfile"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        index: true,
        element: <LandingPage />,
      },
    ],
  },
  {
    path: "/dashboard",
    element: <PrivateRoute />,
    children: [
      {
        path: "",
        element: <Dashboard />,

        children: [
          // {
          //   path: "",
          //   element: <AdminRoute />,
          //   children: [],
          // },
        ],
      },
      { path: "update-profile", element: <UpdateProfilePage /> },
    ],
  },
  {
    path: "/login",
    element: <Login />,
  },

  {
    path: "/register-worker",
    element: <WorkerRegistrationForm />,
  },
  {
    path: "/register-farmer",
    element: <FarmerRegistrationForm />,
  },
  // {
  //   path: "/forgot-password",
  //   element: <ForgotPassword />,
  // },
  // {
  //   path: "/verify",
  //   element: <Verify />,
  // },
  // {
  //   path: "/reset-password",
  //   element: <ResetPassword />,
  // },

  {
    path: "*",
    element: <PageNotFound />,
  },
]);
