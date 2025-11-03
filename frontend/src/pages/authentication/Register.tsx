import { useEffect, useRef, useState } from "react";
import logo from "../../assets/react.svg";
import TextInputField from "../../components/TextInputField";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ArrowLeftIcon from "../../icons/ArrowLeftIcon";
import { toast } from "react-toastify";
import validateUserEmail from "../../utils/validateUserEmail";
import { isStrongPassword } from "../../utils/isStrngPassword";
import { useSignupMutation } from "../../redux/apislices/authApiSlice";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/store";

const Register = () => {
  const SignupRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo } = useSelector((state: RootState) => state.auth);
  const userData = userInfo ? JSON.parse(userInfo) : {};
  const [signup, { isLoading: loadingSignup }] = useSignupMutation();

  const firstnameDivRef = useRef<HTMLDivElement>(null);
  const lastnameDivRef = useRef<HTMLDivElement>(null);
  const emailDivRef = useRef<HTMLDivElement>(null);
  const passwordDivRef = useRef<HTMLDivElement>(null);
  const confirmpasswordDivRef = useRef<HTMLDivElement>(null);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [firstNameValue, setFirstNameValue] = useState("");
  const [lastNameValue, setLastNameValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");

  console.log(referralCode);

  // const imageUrl = "https://jamb-backend.onrender.com/public/logo.png";
  // const signupLink = `https://www.yourwebsite.com/signup`;

  const handleSignup = async () => {
    try {
      if (!firstNameValue) {
        toast.error("First name is required");
      } else if (!lastNameValue) {
        toast.error("Last name is required");
      } else if (!validateUserEmail(emailValue)) {
        toast.error("A valid email is required");
      } else if (!isStrongPassword(passwordValue)) {
        toast.error(
          "Your password does not meet our security requirements. Please ensure it contains at least: 8 or more characters, one uppercase letter (A-Z), one lowercase letter (a-z), one number (0-9), and one special character (!@#$%^&* etc.). For your security, we recommend using a unique and complex passwords"
        );
      } else if (passwordValue !== confirmPasswordValue) {
        toast.error("Password does not match");
      } else {
        const response = await signup({
          firstName: firstNameValue,
          lastName: lastNameValue,
          email: emailValue,
          password: passwordValue,
          referrerCode: referralCode ? referralCode : "",
        });
        console.log("response ===> ", response);
        if (response.data) {
          navigate("/verify-email", {
            state: { email: emailValue }, // Pass data here
          });
          console.log("response success ===> ", response.data);
        }
        if ("error" in response && response.error) {
          let errorMessage = "An unexpected error occurred";

          // Check if it's a FetchBaseQueryError (API error)
          if (
            "data" in response.error &&
            typeof response.error.data === "object"
          ) {
            const errorData = response.error.data as { message?: string };
            errorMessage = errorData.message || errorMessage;
          }

          // Check if it's a SerializedError (Redux internal error)
          if ("message" in response.error) {
            errorMessage = response.error.message || errorMessage;
          }

          toast.error(errorMessage);
        }
      }
    } catch (error) {
      console.log("sign in catch error ==> ", error);
      let errorMessage = "An unexpected error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    if (location.pathname === "/signin" && userData?._id) {
      navigate("/dashboard");
    }
    document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
  }, [location]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("referralCode");
    setReferralCode(code);

    console.log("referral code at signup ===> ", code);
  }, [location.search]);

  return (
    <>
      <section
        id="signup"
        ref={SignupRef}
        className="py-6 lg:py-10 h-full overflow-y-scroll "
      >
        <div className="lg:container w-[90%] lg:w-full py-10 lg:py-16 relative h-full mx-auto flex flex-col md:flex-row justify-center items-center ">
          {/* back button  */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-0 left-4 lg:left-10 p-2  lg:p-4"
          >
            <ArrowLeftIcon color="#008080" />
          </button>
          {/* image container */}
          <div className=" w-full md:h-full md:w-1/2 flex justify-center items-center  ">
            <img
              src={logo}
              alt="About us image"
              className=" w-[30%] md:w-[80%] lg:w-[60%] object-contain"
            />
          </div>

          {/* right text container */}

          <div className="h-full w-[100%] mt-8 md:p-10 rounded-2xl flex flex-col items-center justify-center  mx-auto md:mt-0 md:w-1/2 md:justify-center md:items-center md:mx-0">
            <h2 className="text-center text-xl md:text-2xl lg:text-4xl   mx-auto border-b-custom-gradient font-bold mb-4 lg:mb-10">
              Create An Account
            </h2>
            <TextInputField
              type="text"
              label={"First Name"}
              htmlFor="firstname"
              inputId="firstname"
              divRef={firstnameDivRef}
              setInputValue={setFirstNameValue}
              inputValue={firstNameValue}
            />
            <TextInputField
              type="text"
              label={"Last Name"}
              htmlFor="lastname"
              inputId="lastname"
              divRef={lastnameDivRef}
              setInputValue={setLastNameValue}
              inputValue={lastNameValue}
            />
            <TextInputField
              type="text"
              label={"Email"}
              htmlFor="email"
              inputId="email"
              divRef={emailDivRef}
              setInputValue={setEmailValue}
              inputValue={emailValue}
            />
            <TextInputField
              type="password"
              label={"Password"}
              htmlFor="password"
              inputId="password"
              divRef={passwordDivRef}
              setInputValue={setPasswordValue}
              inputValue={passwordValue}
            />

            <TextInputField
              type="password"
              label={"Confirm Password"}
              htmlFor="cpassword"
              inputId="cpassword"
              divRef={confirmpasswordDivRef}
              setInputValue={setConfirmPasswordValue}
              inputValue={confirmPasswordValue}
            />

            <button
              onClick={handleSignup}
              className="w-full bg-primaryColor text-white rounded-md px-6 py-4 mt-4 md:mt-4 text-base lg:text-xl font-medium "
            >
              {loadingSignup ? (
                <LoadingSpinner width={24} height={24} color="#fff" />
              ) : (
                <p>Sign up</p>
              )}
            </button>

            <div className="w-full mt-6 flex flex-col gap-2  justify-start items-start sm:flex-row  sm:items-center   sm:justify-center  font-semibold">
              <p className="text-sm lg:text-base text-primaryColor ">
                Do you have an account already?
              </p>{" "}
              <Link to={"/signin"} className="underline">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Register;
