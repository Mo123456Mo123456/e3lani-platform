import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "كوكب يولد أمامك",
    short_name: "كوكبك",
    description: "عالمك، قرارك، أثر لا ينتهي.",
    start_url: "/",
    display: "standalone",
    background_color: "#020910",
    theme_color: "#031019",
    lang: "ar",
    dir: "rtl",
  };
}
