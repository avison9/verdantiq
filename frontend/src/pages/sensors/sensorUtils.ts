export const STATUS_STYLES: Record<string, string> = {
  pending:     "bg-orange-100 text-orange-600",
  active:      "bg-emerald-100 text-emerald-700",
  inactive:    "bg-gray-100 text-gray-500",
  error:       "bg-red-100 text-red-600",
  maintenance: "bg-yellow-100 text-yellow-700",
};

export const SENSOR_TYPE_ICONS: Record<string, string> = {
  temperature:  "🌡️",
  humidity:     "💧",
  soil:         "🌱",
  weather:      "🌤️",
  pressure:     "🔵",
  light:        "☀️",
  co2:          "🌫️",
  flow:         "💦",
  environment:  "🍃",
  default:      "📡",
};

export function sensorIcon(type: string): string {
  return SENSOR_TYPE_ICONS[type.toLowerCase()] ?? SENSOR_TYPE_ICONS.default;
}
