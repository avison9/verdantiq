import { APIendPoints } from "../../constants/APIendPoints";
import { baseApiSlice } from "./baseSpiSlice";

interface LoginResponse {
  status: string;
  message: string;
  data: {
    _id: string;
    username: string;
    email: string;
  };
}

interface SigninData {
  email: string;
  password: string;
}

interface IChangePassword {
  userId: string;
  oldPassword: string;
  newPassword: string;
}

interface IChangePasswordResponse {
  status: string;
  message: string;
}

interface VerificationData {
  email: string;
  username: string;
  otp: string;
}

interface IResetPassword {
  email: string;
  newPassword: string;
  resetCode: string;
}
interface IResponse {
  status: string;
  message: string;
}

// username is gotten from email in this project newEmail.split('@)[0]

export const authApiSlice = baseApiSlice.injectEndpoints({
  endpoints: (builder) => ({
    signup: builder.mutation<any, IUser>({
      query: (data) => ({
        url: APIendPoints.register,
        method: "POST",
        body: data,
      }),
    }),
    signin: builder.mutation<LoginResponse, SigninData>({
      query: (data) => ({
        url: APIendPoints.login,
        method: "POST",
        body: data,
      }),
    }),
    verifyEmail: builder.mutation<LoginResponse, VerificationData>({
      query: (data) => ({
        url: `verify-email`,
        method: "POST",
        body: data,
      }),
    }),
    resendOtp: builder.mutation<any, { email: string }>({
      query: (data) => ({
        url: `resend-otp`,
        method: "POST",
        body: data,
      }),
    }),
    forgotPassword: builder.mutation<IResponse, { email: string }>({
      query: (data) => ({
        url: `/forgot-password`,
        method: "POST",
        body: data,
      }),
    }),
    resetPassword: builder.mutation<IResponse, IResetPassword>({
      query: (data) => ({
        url: `reset-password`,
        method: "POST",
        body: data,
      }),
    }),
    changePassword: builder.mutation<IChangePasswordResponse, IChangePassword>({
      query: (data) => ({
        url: `/change-password`,
        method: "PUT",
        body: data,
      }),
    }),
    signout: builder.mutation<void, void>({
      query: () => ({
        url: `signout`,
        method: "POST",
      }),
    }),
  }),
});

export const {
  useSignupMutation,
  useSigninMutation,
  useSignoutMutation,
  useVerifyEmailMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useResendOtpMutation,
} = authApiSlice;
