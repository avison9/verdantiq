import { APIendPoints } from "../../constants/APIendPoints";
import { baseApiSlice } from "./baseSpiSlice";

export const authApiSlice = baseApiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query<IUser, { userId: string }>({
      query: (data) => ({
        url: APIendPoints.profile,
        body: data,
      }),
      providesTags: ["Profile"],
    }),
    updateProfile: builder.mutation<any, IUser>({
      query: (data) => ({
        url: APIendPoints.profile,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Profile"],
    }),
  }),
});

export const { useGetProfileQuery, useUpdateProfileMutation } = authApiSlice;
