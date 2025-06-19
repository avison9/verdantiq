import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/authentication/Login";
import Register from "./pages/authentication/Register";
import ForgotPassword from "./pages/authentication/ForgotPassword";
import Verify from "./pages/authentication/Verify";
import ResetPassword from "./pages/authentication/ResetPassword";
import PageNotFound from "./components/PageNotFound";

// const Signup = lazy(() => import("./pages/auth/Signup"));
// const Signin = lazy(() => import("./pages/auth/Signin"));

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
  // {
  //   path: "",
  //   element: <PrivateRoute />,
  //   children: [
  //     {
  //       path: "",
  //       element: <Dashboard />,
  //       children: [

  //         {
  //           path: "",
  //           element: <AdminRoute />,
  //           children: [

  //           ],
  //         },
  //       ],
  //     },
  //   ],
  // },
  {
    path: "/login",
    children: [
      {
        path: "/login",
        index: true,
        element: <Login />,
      },
    ],
  },

  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/verify",
    element: <Verify />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },

  {
    path: "*",
    element: <PageNotFound />,
  },
]);
