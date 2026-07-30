import { Providers } from "./providers";
import { WorldDashboard } from "@/components/WorldDashboard";

export default function HomePage() {
  return (
    <Providers>
      <WorldDashboard />
    </Providers>
  );
}
