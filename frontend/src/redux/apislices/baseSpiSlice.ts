import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { APIendPoints } from "../../constants/APIendPoints";

const baseQuery = fetchBaseQuery({
  baseUrl: APIendPoints.baseUrl,
  credentials: "include",
});

export const baseApiSlice = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Feedback", "User", "Question", "Result", "Token"],
  endpoints: () => ({}),
});

export type ApiSlice = typeof baseApiSlice;
