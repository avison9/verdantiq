import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import type { RootState } from "../redux/store";
import { logout as logoutAction } from "../redux/slices/authSlice";
import { useLogoutMutation } from "../redux/apislices/authApiSlice";

const Header = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userInfo = useSelector((state: RootState) => state.auth.userInfo);
  const [logoutApi] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logoutApi().unwrap();
    } catch {
      // ignore — clear local state regardless
    }
    dispatch(logoutAction());
    navigate("/login");
    toast.success("Signed out successfully");
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link to={userInfo ? "/dashboard" : "/"} className="text-emerald-700 font-bold text-lg">
        VerdantIQ
      </Link>

      <nav className="flex items-center gap-4 text-sm">
        {userInfo ? (
          <>
            <Link to="/dashboard" className="text-gray-600 hover:text-emerald-600 transition-colors">
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-500 transition-colors"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-gray-600 hover:text-emerald-600 transition-colors">
              Sign in
            </Link>
            <Link
              to="/register"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              Get started
            </Link>
          </>
        )}
      </nav>
    </header>
  );
};

export default Header;
