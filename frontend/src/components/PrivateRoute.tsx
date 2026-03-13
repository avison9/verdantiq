import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../redux/store";
import { useGetMeQuery } from "../redux/apislices/authApiSlice";

const PrivateRoute = () => {
  const userInfo = useSelector((state: RootState) => state.auth.userInfo);
  const { isLoading, isError } = useGetMeQuery(undefined, { skip: !userInfo });

  if (!userInfo) return <Navigate to="/login" replace />;
  if (isLoading) return null;
  if (isError) return <Navigate to="/login" replace />;

  return <Outlet />;
};

export default PrivateRoute;
