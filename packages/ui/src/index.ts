export const categoryColors: Record<string, string> = {
  plant: "#3dff9a",
  creature: "#3ecbff",
  weather: "#7dd3fc",
  disaster: "#ff8a3d",
  civilization: "#f0c14a",
  invention: "#2dd4bf",
  migration: "#b07cff",
  war: "#ff4d6d",
  resource: "#a3e635",
  disease: "#fb7185",
};

export function importanceColor(importance: number): string {
  if (importance >= 0.85) return "#ff4d6d";
  if (importance >= 0.65) return "#ff8a3d";
  if (importance >= 0.45) return "#f0c14a";
  return "#3ecbff";
}
