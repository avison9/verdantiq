import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { APIendPoints } from "../../constants/APIendPoints";
import { logout } from "../slices/authSlice";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: APIendPoints.baseUrl,
  credentials: "include",
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    api.dispatch(logout());
    window.location.href = "/login";
  }
  return result;
};

export const baseApiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Feedback", "User", "Question", "Result", "Token", "Sensor", "Billing", "Transaction"],
  endpoints: () => ({}),
});

export type ApiSlice = typeof baseApiSlice;
