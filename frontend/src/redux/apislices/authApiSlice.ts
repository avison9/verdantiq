import { baseApiSlice } from "./baseSpiSlice";
import { APIendPoints } from "../../constants/APIendPoints";

// ─── Request / Response types (aligned with FastAPI schemas) ─────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  tenant_name?: string;
  tenant_id?: number;
  tenant_profile?: {
    country?: string;
    address?: string;
    farm_size?: number;
    crop_types?: string[];
  };
  user_profile?: {
    country?: string;
    address?: string;
    role?: string;
    position?: string;
  };
}

export interface RegisterResponse {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  tenant_id: number;
  status: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface UserProfile {
  role?: string;
  position?: string;
  country?: string;
  address?: string;
}

export interface MeResponse {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  tenant_id: number;
  status: string;
  profile?: UserProfile;
}

export interface UpdateMeRequest {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  user_profile?: UserProfile;
  tenant_profile?: {
    country?: string;
    address?: string;
    farm_size?: number;
    crop_types?: string[];
  };
}

export interface MessageResponse {
  message: string;
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export const authApiSlice = baseApiSlice.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (data) => ({
        url: APIendPoints.register,
        method: "POST",
        body: data,
      }),
    }),
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (data) => ({
        url: APIendPoints.login,
        method: "POST",
        body: data,
      }),
    }),
    logout: builder.mutation<MessageResponse, void>({
      query: () => ({
        url: APIendPoints.logout,
        method: "POST",
      }),
    }),
    forgotPassword: builder.mutation<MessageResponse, ForgotPasswordRequest>({
      query: (data) => ({
        url: APIendPoints.forgotPassword,
        method: "POST",
        body: data,
      }),
    }),
    resetPassword: builder.mutation<MessageResponse, ResetPasswordRequest>({
      query: (data) => ({
        url: APIendPoints.resetPassword,
        method: "POST",
        body: data,
      }),
    }),
    getMe: builder.query<MeResponse, void>({
      query: () => APIendPoints.me,
      providesTags: ["User"],
    }),
    updateMe: builder.mutation<MeResponse, UpdateMeRequest>({
      query: (data) => ({
        url: APIendPoints.me,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["User"],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetMeQuery,
  useUpdateMeMutation,
} = authApiSlice;
