import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import { RootState } from "../redux/store";

const PrivateRoute = () => {
  const { userInfo } = useSelector((state: RootState) => state.auth);
  const user = "";
  // const [userData, setUserData] = useState<UserDataProps | null>(null);
  // const [loading, setLoading] = useState<boolean>(true);

  // const decryptData = async () => {
  //   const decryptedText = await decryptWithRSA(
  //     import.meta.env.VITE_PRIVATE_KEY,
  //     userInfo
  //   );

  //   try {
  //     const parsedData =
  //       typeof decryptedText === "object"
  //         ? decryptedText
  //         : JSON.parse(decryptedText || "");

  //     setUserData(parsedData);
  //     return userData?._id ? <Outlet /> : <Navigate to="/" replace />;
  //   } catch (error) {
  //     console.error("Failed to parse decrypted text:", error);
  //   }
  // };

  // useEffect(() => {
  //   if (userInfo) {
  //     decryptData();
  //   } else {
  //   }
  // }, [userInfo]);

  // return userInfo && JSON.parse(userInfo)?._id !== "" ? (
  //   <Outlet />
  // ) : (
  //   <Navigate to="/" replace />
  // );

  return user === "" ? <Outlet /> : <Navigate to="/" replace />;
};

export default PrivateRoute;
