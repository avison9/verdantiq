import { baseApiSlice } from "./baseSpiSlice";
import { APIendPoints } from "../../constants/APIendPoints";

export type SensorStatus = "pending" | "active" | "inactive" | "error" | "maintenance";

export interface Sensor {
  sensor_id: string;
  tenant_id: number;
  user_id: number;
  sensor_name: string;
  sensor_type: string;
  location: string | null;
  sensor_metadata: Record<string, unknown> | null;
  mqtt_token: string;
  message_count: number;
  status: SensorStatus;
  last_message_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SensorPage {
  items: Sensor[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SensorAuditLog {
  id: number;
  tenant_id: number;
  sensor_id: string | null;
  sensor_name: string;
  action: string;
  performed_by: number;
  performed_by_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface SensorConnectionEvent {
  id: number;
  sensor_id: string;
  tenant_id: number;
  event_type: string;
  status: string;
  message: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface SensorConnectionEventPage {
  items: SensorConnectionEvent[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SensorAuditPage {
  items: SensorAuditLog[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface Billing {
  id: number;
  tenant_id: number;
  status: "active" | "inactive" | "suspended";
  frequency: string;
  payment_method: string;
  amount_due: number;
  balance?: number;
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
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  operating_system?: string;
  power_type?: string;
}

export interface SensorUpdate {
  sensor_id: string;
  sensor_name?: string;
  sensor_type?: string;
  location?: string;
  sensor_metadata?: Record<string, unknown>;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  operating_system?: string;
  power_type?: string;
}

export interface BillingTopUp {
  amount: number;
  payment_method: string;
  cardholder_name?: string;
  card_number?: string;
  card_expiry?: string;
  card_cvv?: string;
  payer_email?: string;
  reference?: string;
}

export interface Transaction {
  id: number;
  billing_id: number;
  type: "credit" | "debit";
  amount: number;
  balance_after: number;
  description: string;
  payment_method?: string;
  card_last4?: string;
  card_brand?: string;
  sensor_id?: string;
  sensor_name?: string;
  usage_period?: string;
  data_points?: number;
  reference?: string;
  created_at: string;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export const userDashboardApiSlice = baseApiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSensors: builder.query<SensorPage, { tenant_id: number; page?: number; per_page?: number }>({
      query: ({ tenant_id, page = 1, per_page = 10 }) =>
        `${APIendPoints.sensors}/?tenant_id=${tenant_id}&page=${page}&per_page=${per_page}`,
      providesTags: ["Sensor"],
    }),
    getSensor: builder.query<Sensor, string>({
      query: (sensor_id) => `${APIendPoints.sensors}/${sensor_id}`,
      providesTags: ["Sensor"],
    }),
    getSensorAudit: builder.query<SensorAuditPage, { page?: number; per_page?: number }>({
      query: ({ page = 1, per_page = 20 } = {}) =>
        `${APIendPoints.sensors}/audit/?page=${page}&per_page=${per_page}`,
      providesTags: ["Sensor"],
    }),
    createSensor: builder.mutation<Sensor, SensorCreate>({
      query: (body) => ({
        url: `${APIendPoints.sensors}/`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Sensor"],
    }),
    updateSensor: builder.mutation<Sensor, SensorUpdate>({
      query: ({ sensor_id, ...body }) => ({
        url: `${APIendPoints.sensors}/${sensor_id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Sensor"],
    }),
    renameSensor: builder.mutation<Sensor, { sensor_id: string; sensor_name: string }>({
      query: ({ sensor_id, sensor_name }) => ({
        url: `${APIendPoints.sensors}/${sensor_id}/rename`,
        method: "PATCH",
        body: { sensor_name },
      }),
      invalidatesTags: ["Sensor"],
    }),
    updateSensorStatus: builder.mutation<Sensor, { sensor_id: string; status: SensorStatus }>({
      query: ({ sensor_id, status }) => ({
        url: `${APIendPoints.sensors}/${sensor_id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: ["Sensor"],
    }),
    deleteSensor: builder.mutation<Sensor, string>({
      query: (sensor_id) => ({
        url: `${APIendPoints.sensors}/${sensor_id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Sensor"],
    }),
    initiateConnection: builder.mutation<SensorConnectionEvent, string>({
      query: (sensor_id) => ({
        url: `${APIendPoints.sensors}/${sensor_id}/connect`,
        method: "POST",
      }),
      invalidatesTags: ["Sensor"],
    }),
    getSensorConnectionEvents: builder.query<SensorConnectionEventPage, { sensor_id: string; page?: number; per_page?: number }>({
      query: ({ sensor_id, page = 1, per_page = 20 }) =>
        `${APIendPoints.sensors}/${sensor_id}/connection-events?page=${page}&per_page=${per_page}`,
      providesTags: ["Sensor"],
    }),
    getBilling: builder.query<Billing, void>({
      query: () => `${APIendPoints.billings}/`,
      providesTags: ["User", "Billing"],
    }),
    topUpBilling: builder.mutation<Billing, BillingTopUp>({
      query: (body) => ({
        url: `${APIendPoints.billingTopup}/`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["User", "Billing", "Transaction"],
    }),
    getTransactions: builder.query<TransactionPage, { page?: number; per_page?: number }>({
      query: ({ page = 1, per_page = 20 } = {}) =>
        `${APIendPoints.billingTransactions}/?page=${page}&per_page=${per_page}`,
      providesTags: ["Transaction"],
    }),
  }),
});

export const {
  useGetSensorsQuery,
  useGetSensorQuery,
  useGetSensorAuditQuery,
  useGetBillingQuery,
  useCreateSensorMutation,
  useUpdateSensorMutation,
  useRenameSensorMutation,
  useUpdateSensorStatusMutation,
  useDeleteSensorMutation,
  useInitiateConnectionMutation,
  useGetSensorConnectionEventsQuery,
  useTopUpBillingMutation,
  useGetTransactionsQuery,
} = userDashboardApiSlice;
