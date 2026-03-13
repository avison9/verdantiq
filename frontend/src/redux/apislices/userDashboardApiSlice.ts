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

export interface SensorCreate {
  tenant_id: number;
  sensor_name: string;
  sensor_type: string;
  location?: string;
  sensor_metadata?: Record<string, unknown>;
}

export const userDashboardApiSlice = baseApiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSensors: builder.query<Sensor[], { tenant_id: number; limit?: number }>({
      query: ({ tenant_id, limit = 100 }) =>
        `${APIendPoints.sensors}/?tenant_id=${tenant_id}&limit=${limit}`,
      providesTags: ["Sensor"],
    }),
    getBilling: builder.query<Billing, void>({
      query: () => `${APIendPoints.billings}/`,
      providesTags: ["User"],
    }),
    createSensor: builder.mutation<Sensor, SensorCreate>({
      query: (body) => ({
        url: `${APIendPoints.sensors}/`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Sensor"],
    }),
  }),
});

export const {
  useGetSensorsQuery,
  useGetBillingQuery,
  useCreateSensorMutation,
} = userDashboardApiSlice;
