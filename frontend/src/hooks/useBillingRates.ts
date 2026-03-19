import { useGetBillingRatesQuery } from "../redux/apislices/userDashboardApiSlice";

// Fallback defaults match the backend model defaults
const DEFAULTS = {
  message_rate: 0.0005,
  storage_rate: 0.50,
  query_rate:   0.001,
};

/**
 * Returns billing rates from the database (single source of truth).
 * Falls back to defaults while loading or on error so pages always have a value.
 */
export function useBillingRates() {
  const { data, isLoading } = useGetBillingRatesQuery();
  return {
    message_rate: data?.message_rate ?? DEFAULTS.message_rate,
    storage_rate: data?.storage_rate ?? DEFAULTS.storage_rate,
    query_rate:   data?.query_rate   ?? DEFAULTS.query_rate,
    isLoading,
  };
}
