import { LandingLoginPanel } from "@/components/landing/LandingLoginPanel";
import { LandingVideoPlane } from "@/components/landing/LandingVideoPlane";

export default function HomePage() {
  return (
    <main className="grid min-h-[100svh] bg-[#f8f7f3] lg:grid-cols-[minmax(440px,0.92fr)_minmax(0,1.08fr)]">
      <LandingLoginPanel />
      <LandingVideoPlane />
    </main>
  );
}
