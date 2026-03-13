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
}

export interface BillingTopUp {
  amount: number;
  payment_method: string;
  // Credit card
  cardholder_name?: string;
  card_number?: string;
  card_expiry?: string;
  card_cvv?: string;
  // PayPal / Skrill / Revolut
  payer_email?: string;
  // Wire transfer
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
  sensor_id?: number;
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
    getSensors: builder.query<Sensor[], { tenant_id: number; limit?: number }>({
      query: ({ tenant_id, limit = 100 }) =>
        `${APIendPoints.sensors}/?tenant_id=${tenant_id}&limit=${limit}`,
      providesTags: ["Sensor"],
    }),
    getBilling: builder.query<Billing, void>({
      query: () => `${APIendPoints.billings}/`,
      providesTags: ["User", "Billing"],
    }),
    createSensor: builder.mutation<Sensor, SensorCreate>({
      query: (body) => ({
        url: `${APIendPoints.sensors}/`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Sensor"],
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
  useGetBillingQuery,
  useCreateSensorMutation,
  useTopUpBillingMutation,
  useGetTransactionsQuery,
} = userDashboardApiSlice;
