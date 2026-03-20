import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CycleTracker",
    short_name: "CycleTracker",
    description: "Il tuo diario ciclistico personale",
    start_url: "/races",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#ffff00",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
