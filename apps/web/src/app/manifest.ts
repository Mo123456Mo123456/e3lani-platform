import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "كوكب يولد أمامك",
    short_name: "كوكب",
    description: "عالمك، قرارك، أثر لا ينتهي.",
    start_url: "/",
    display: "standalone",
    background_color: "#020b12",
    theme_color: "#03101a",
    lang: "ar",
    dir: "rtl",
    icons: [],
  };
}
