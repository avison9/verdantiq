import { baseApiSlice } from "./baseSpiSlice";
import { APIendPoints } from "../../constants/APIendPoints";

export interface Sensor {
  sensor_id: number;
  tenant_id: number;
  user_id: number;
  sensor_name: string;
  sensor_type: string;
  location: string | null;
  message_count: number;
  status: "active" | "inactive" | "error" | "maintenance";
  created_at: string;
  updated_at: string | null;
}

export interface Billing {
  id: number;
  tenant_id: number;
  status: "active" | "inactive" | "suspended";
  frequency: string;
  payment_method: string;
  amount_due: number;
  message_count: number;
  sensor_count: number;
  due_date: string;
  last_payment_date: string | null;
}

export const userDashboardApiSlice = baseApiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSensors: builder.query<Sensor[], { tenant_id: number; limit?: number }>({
      query: ({ tenant_id, limit = 100 }) =>
        `${APIendPoints.sensors}/?tenant_id=${tenant_id}&limit=${limit}`,
      providesTags: ["User"],
    }),
    getBilling: builder.query<Billing, void>({
      query: () => `${APIendPoints.billings}/`,
      providesTags: ["User"],
    }),
  }),
});

export const { useGetSensorsQuery, useGetBillingQuery } = userDashboardApiSlice;
