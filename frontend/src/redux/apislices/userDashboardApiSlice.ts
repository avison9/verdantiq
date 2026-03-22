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
  farm_id: string | null;
  sensor_metadata: Record<string, unknown> | null;
  mqtt_token: string;
  message_count: number;
  storage_bytes: number;
  status: SensorStatus;
  last_message_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Farm {
  farm_id: string;
  tenant_id: number;
  farm_name: string;
  address: string | null;
  country: string | null;
  farm_size_ha: number | null;
  farm_type: string | null;
  latitude: number | null;
  longitude: number | null;
  perimeter_km: number | null;
  crops: string[] | null;
  rainfall_avg_mm: number | null;
  sunlight_avg_hrs: number | null;
  soil_type: string | null;
  crop_history: Record<string, unknown>[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface FarmPage {
  items: Farm[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface FarmCreate {
  farm_name: string;
  address?: string;
  country?: string;
  farm_size_ha?: number;
  farm_type?: string;
  latitude?: number;
  longitude?: number;
  perimeter_km?: number;
  crops?: string[];
  rainfall_avg_mm?: number;
  sunlight_avg_hrs?: number;
  soil_type?: string;
  crop_history?: Record<string, unknown>[];
  notes?: string;
}

export type FarmUpdate = Partial<FarmCreate>;

export interface BillingRate {
  id: number;
  message_rate: number;
  storage_rate: number;
  query_rate: number;
  created_at: string;
  updated_at: string | null;
}

export interface SensorStorage {
  storage_id: string;
  tenant_id: number;
  sensor_id: string | null;
  allocated_gb: number;
  used_bytes: number;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export interface SensorStoragePage {
  items: SensorStorage[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SensorStorageCreate {
  sensor_id?: string;
  allocated_gb: number;
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
  farm_id?: string;
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

export interface BillingFrequencyUpdate {
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
}

export interface BillingProcessCycle {
  usage_period?: string;
}

export interface Transaction {
  id: number;
  billing_id: number;
  type: "credit" | "debit" | "usage";
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

export interface CropManagement {
  id: string;
  farm_id: string;
  tenant_id: number;
  crop_name: string;
  area_ha: number | null;
  grain_type: string | null;
  grains_planted: number | null;
  planting_date: string | null;
  expected_harvest_date: string | null;
  notes: string | null;
  avg_sunlight_hrs: number | null;
  soil_ph: number | null;
  soil_humidity: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface CropManagementPage {
  items: CropManagement[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface CropManagementCreate {
  farm_id: string;
  crop_name: string;
  area_ha?: number;
  grain_type?: string;
  grains_planted?: number;
  planting_date?: string;
  expected_harvest_date?: string;
  notes?: string;
  avg_sunlight_hrs?: number;
  soil_ph?: number;
  soil_humidity?: number;
}

export type CropManagementUpdate = Partial<Omit<CropManagementCreate, "farm_id">>;

export interface QueryRequest {
  sql: string;
}

export interface QueryResult {
  columns: string[];
  rows: (string | null)[][];
  ms: number;
  qu: number;
  cost: number;
}

export interface SchemaColumn { name: string; type: string; }
export interface SchemaTable  { name: string; cols: SchemaColumn[]; }
export interface SchemaEntry  { name: string; tables: SchemaTable[]; }
export interface CatalogEntry { name: string; schemas: SchemaEntry[]; }
export interface SchemaTree   { catalogs: CatalogEntry[]; }

export interface QueryHistoryItem { ts: string; sql: string; ms: number; qu: number; cost: number; columns: string[]; rows: (string | null)[][]; }
export interface QueryHistory     { items: QueryHistoryItem[]; }
export interface LastSqlResponse  { sql: string | null; }

export interface QueryStatsResponse {
  query_count: number;
  total_qu: number;
  total_cost: number;
}

export interface UsageLineItem {
  id: number;
  reference?: string;
  description: string;
  amount: number;
  data_points?: number;
  created_at: string;
}

export interface CycleDetailResponse {
  usage_period: string;
  cycle_amount: number;
  cycle_date?: string;
  message_count: number;
  message_cost: number;
  query_items: UsageLineItem[];
  query_total_cost: number;
  query_total_qu: number;
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
    logConnectionEvent: builder.mutation<SensorConnectionEvent, {
      sensor_id: string;
      event_type: string;
      status?: string;
      message?: string;
      details?: Record<string, unknown>;
    }>({
      query: ({ sensor_id, ...body }) => ({
        url: `${APIendPoints.sensors}/${sensor_id}/connection-events`,
        method: "POST",
        body,
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
    suspendBilling: builder.mutation<Billing, { amount_due: number }>({
      query: (body) => ({
        url: `${APIendPoints.billingSuspend}`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Billing"],
    }),
    getBillingRates: builder.query<BillingRate, void>({
      query: () => `${APIendPoints.billingRates}/`,
      providesTags: ["Billing"],
    }),
    updateBillingRates: builder.mutation<BillingRate, Partial<BillingRate>>({
      query: (body) => ({
        url: `${APIendPoints.billingRates}/`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Billing"],
    }),
    getSensorStorageList: builder.query<SensorStoragePage, { page?: number; per_page?: number }>({
      query: ({ page = 1, per_page = 20 } = {}) =>
        `${APIendPoints.storage}/?page=${page}&per_page=${per_page}`,
      providesTags: ["Sensor"],
    }),
    createSensorStorage: builder.mutation<SensorStorage, SensorStorageCreate>({
      query: (body) => ({
        url: `${APIendPoints.storage}/`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Sensor"],
    }),
    deleteSensorStorage: builder.mutation<void, string>({
      query: (storage_id) => ({
        url: `${APIendPoints.storage}/${storage_id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Sensor"],
    }),
    updateBillingFrequency: builder.mutation<Billing, BillingFrequencyUpdate>({
      query: (body) => ({
        url: `${APIendPoints.billingFrequency}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Billing"],
    }),
    processBillingCycle: builder.mutation<Billing, BillingProcessCycle>({
      query: (body) => ({
        url: `${APIendPoints.billingProcessCycle}`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Billing", "Transaction"],
    }),
    getFarms: builder.query<FarmPage, { page?: number; per_page?: number }>({
      query: ({ page = 1, per_page = 100 } = {}) =>
        `${APIendPoints.farms}/?page=${page}&per_page=${per_page}`,
      providesTags: ["Farm"],
    }),
    getFarm: builder.query<Farm, string>({
      query: (farm_id) => `${APIendPoints.farms}/${farm_id}`,
      providesTags: ["Farm"],
    }),
    createFarm: builder.mutation<Farm, FarmCreate>({
      query: (body) => ({
        url: `${APIendPoints.farms}/`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Farm"],
    }),
    updateFarm: builder.mutation<Farm, { farm_id: string } & FarmUpdate>({
      query: ({ farm_id, ...body }) => ({
        url: `${APIendPoints.farms}/${farm_id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Farm"],
    }),
    deleteFarm: builder.mutation<void, string>({
      query: (farm_id) => ({
        url: `${APIendPoints.farms}/${farm_id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Farm"],
    }),
    getCrops: builder.query<CropManagementPage, { farm_id?: string; page?: number; per_page?: number }>({
      query: ({ farm_id, page = 1, per_page = 50 } = {}) => {
        const params = new URLSearchParams({ page: String(page), per_page: String(per_page) });
        if (farm_id) params.set("farm_id", farm_id);
        return `${APIendPoints.cropManagement}/?${params}`;
      },
      providesTags: ["Farm"],
    }),
    getCrop: builder.query<CropManagement, string>({
      query: (crop_id) => `${APIendPoints.cropManagement}/${crop_id}`,
      providesTags: ["Farm"],
    }),
    createCrop: builder.mutation<CropManagement, CropManagementCreate>({
      query: (body) => ({
        url: `${APIendPoints.cropManagement}/`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Farm"],
    }),
    updateCrop: builder.mutation<CropManagement, { id: string } & CropManagementUpdate>({
      query: ({ id, ...body }) => ({
        url: `${APIendPoints.cropManagement}/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Farm"],
    }),
    deleteCrop: builder.mutation<void, string>({
      query: (id) => ({
        url: `${APIendPoints.cropManagement}/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Farm"],
    }),
    runQuery: builder.mutation<QueryResult, QueryRequest>({
      query: (body) => ({
        url: `${APIendPoints.query}/`,
        method: "POST",
        body,
      }),
    }),
    getQuerySchema: builder.query<SchemaTree, void>({
      query: () => `${APIendPoints.query}/schema`,
    }),
    getQueryHistory: builder.query<QueryHistory, void>({
      query: () => `${APIendPoints.query}/history`,
      keepUnusedDataFor: 0,
    }),
    getLastSql: builder.query<LastSqlResponse, void>({
      query: () => `${APIendPoints.query}/last-sql`,
      keepUnusedDataFor: 0,
    }),
    getQueryStats: builder.query<QueryStatsResponse, { sensor_id?: string; farm_id?: string }>({
      query: ({ sensor_id, farm_id } = {}) => {
        const params = new URLSearchParams();
        if (sensor_id) params.set("sensor_id", sensor_id);
        else if (farm_id) params.set("farm_id", farm_id);
        return `${APIendPoints.billings}/query-stats?${params.toString()}`;
      },
    }),
    getCycleDetail: builder.query<CycleDetailResponse, string>({
      query: (usage_period) =>
        `${APIendPoints.billings}/cycle-detail?usage_period=${encodeURIComponent(usage_period)}`,
      keepUnusedDataFor: 0,
    }),
    clearQueryHistory: builder.mutation<void, void>({
      query: () => ({
        url: `${APIendPoints.query}/history`,
        method: "DELETE",
      }),
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
  useLogConnectionEventMutation,
  useGetSensorConnectionEventsQuery,
  useTopUpBillingMutation,
  useGetTransactionsQuery,
  useUpdateBillingFrequencyMutation,
  useProcessBillingCycleMutation,
  useSuspendBillingMutation,
  useGetBillingRatesQuery,
  useUpdateBillingRatesMutation,
  useGetSensorStorageListQuery,
  useCreateSensorStorageMutation,
  useDeleteSensorStorageMutation,
  useGetFarmsQuery,
  useGetFarmQuery,
  useCreateFarmMutation,
  useUpdateFarmMutation,
  useDeleteFarmMutation,
  useGetCropsQuery,
  useGetCropQuery,
  useCreateCropMutation,
  useUpdateCropMutation,
  useDeleteCropMutation,
  useRunQueryMutation,
  useGetQuerySchemaQuery,
  useGetQueryHistoryQuery,
  useGetLastSqlQuery,
  useGetQueryStatsQuery,
  useGetCycleDetailQuery,
  useClearQueryHistoryMutation,
} = userDashboardApiSlice;
