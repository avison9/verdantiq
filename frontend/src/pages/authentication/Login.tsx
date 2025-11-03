import React, { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { Mail, Lock, LogIn, ArrowLeft } from "lucide-react";
import { APIendPoints } from "../../constants/APIendPoints";
import { useSigninMutation } from "../../redux/apislices/authApiSlice";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { SerializedError } from "@reduxjs/toolkit";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setCredentials } from "../../redux/slices/authSlice";

// --- TYPE DEFINITIONS ---

interface CardProps {
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

interface ButtonProps {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "ghost";
  size?: "default" | "lg";
  type?: "button" | "submit" | "reset";
}

interface InputProps {
  id: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

// --- MOCK UI COMPONENTS (Replicating Shadcn/Tailwind Aesthetics) ---

const Card: React.FC<CardProps> = ({ children, className = "" }) => (
  <div className={`rounded-xl bg-white/95 backdrop-blur-sm ${className}`}>
    {children}
  </div>
);

const CardHeader: React.FC<CardProps> = ({ children, className = "" }) => (
  <div className={`p-6 border-b rounded-t-xl ${className}`}>{children}</div>
);

const CardTitle: React.FC<CardProps> = ({ children, className = "" }) => (
  <h1 className={`text-2xl font-bold ${className}`}>{children}</h1>
);

const CardContent: React.FC<CardProps> = ({ children, className = "" }) => (
  <div className={`p-8 ${className}`}>{children}</div>
);

const Label: React.FC<CardProps> = ({ htmlFor, children, className = "" }) => (
  <label
    htmlFor={htmlFor}
    className={`block text-sm font-medium text-gray-700 mb-1 ${className}`}
  >
    {children}
  </label>
);

const Input: React.FC<InputProps> = ({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  className = "",
}) => (
  <div className="relative">
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out placeholder-gray-400 ${className}`}
    />
    {(id === "email" || id === "password") && (
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
        {id === "email" && <Mail className="h-5 w-5 text-gray-400" />}
        {id === "password" && <Lock className="h-5 w-5 text-gray-400" />}
      </div>
    )}
  </div>
);

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled,
  className = "",
  variant = "default",
  size = "default",
  type = "button",
}) => {
  let baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2";

  if (variant === "default") {
    baseClasses +=
      " bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500";
  } else if (variant === "ghost") {
    baseClasses += " text-gray-600 hover:bg-gray-100 focus:ring-gray-300";
  }

  if (size === "lg") {
    baseClasses += " px-6 py-3 text-base";
  } else {
    baseClasses += " px-4 py-2 text-sm";
  }

  const disabledClasses = disabled ? "opacity-60 cursor-not-allowed" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  );
};

// --- MAIN LOGIN COMPONENT ---

const Login: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  // Local state for user feedback, separated from RTK Query state
  const [localError, setLocalError] = useState<string>("");
  const [localSuccess, setLocalSuccess] = useState<string>("");

  // Use the mock RTK Query hook
  const [signin, { isLoading, isError, isSuccess, error, data }] =
    useSigninMutation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Api base url ===>> ", APIendPoints.baseUrl);

    try {
      const res = await signin({
        email: email,
        password: password,
      });

      if (res.data) {
        console.log("login response ===>>> ", res.data);

        dispatch(setCredentials(res.data));
        navigate("/dashboard");
        alert(res.data?.message);
      }

      if ("error" in res && res.error) {
        console.log("sign res error ===>>> ", res.error);

        let errorMessage = "An unexpected error occurred";

        const error = res.error as FetchBaseQueryError | SerializedError;

        // ✅ Handle FetchBaseQueryError
        if ("status" in error) {
          if (error.status === "FETCH_ERROR") {
            errorMessage =
              "Network error. Please check your internet connection and try again.";
          } else if (typeof error.status === "number" && error.status >= 500) {
            errorMessage = "Server is unavailable. Please try again later.";
          } else if (typeof error.status === "number" && error.status === 404) {
            errorMessage = "Service not found. Please contact support.";
          } else if ("data" in error && typeof error.data === "object") {
            const errorData = error.data as { message?: string };
            errorMessage = errorData.message || errorMessage;
          }
        }

        // ✅ Handle SerializedError
        if ("message" in error && error.message) {
          errorMessage = error.message;
        }

        // alert(errorMessage);
      }
    } catch (error) {
      let errorMessage = "An unexpected error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      if (errorMessage.includes("Network request failed")) {
        errorMessage =
          "Network error. Please check your internet connection and try again.";
      }
    }
  };
  // Mock function for navigation, matching the original structure
  const handleBack = () => navigate(-1);

  // Handle side effects after mutation completes
  useEffect(() => {
    if (isSuccess && data) {
      setLocalSuccess(data.message || "Login successful! Redirecting...");
      setLocalError("");
      // Here you would typically dispatch an action to save user data/token
      // and navigate away.
    } else if (isError) {
      // Handle the error object structure returned by the API/mock
      const errorMessage =
        (error as any)?.message ||
        "An unexpected error occurred. Please check your network.";
      setLocalError(errorMessage);
      setLocalSuccess("");
    }
  }, [isSuccess, isError, data, error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50/30 via-background to-green-50/20 p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full mx-auto">
        {/* Mock Back Button (using console log instead of <Link>) */}
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-6 text-blue-700 hover:text-blue-900"
        >
          <div className="flex flex-row items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </div>
        </Button>

        <Card className="border-2 shadow-2xl border-blue-200/50 transform transition-all hover:shadow-blue-300/50">
          <CardHeader className="text-center bg-gradient-to-r from-blue-50 to-blue-100/50">
            <div className="mx-auto p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg mb-4 w-fit">
              <LogIn className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-3xl text-blue-900">
              Welcome Back
            </CardTitle>
            <p className="text-blue-700 mt-1">
              Log in to access your Farm Dashboard
            </p>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-1">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="pr-10"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
              </div>

              {/* Error and Success Messages */}
              {localError && (
                <div className="p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg">
                  {localError}
                </div>
              )}
              {localSuccess && (
                <div className="p-3 text-sm text-green-700 bg-green-100 border border-green-300 rounded-lg">
                  {localSuccess}
                </div>
              )}

              {/* Login Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      Logging In...
                    </div>
                  ) : (
                    <>
                      Sign In
                      <LogIn className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Forgot Password Link */}
            <div className="mt-4 text-center">
              <a
                href="#"
                onClick={() => console.log("Forgot Password clicked")}
                className="text-sm text-blue-600 hover:text-blue-800 transition duration-150"
              >
                Forgot your password?
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
