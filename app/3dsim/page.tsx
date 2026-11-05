import type { Metadata } from "next";
import Sim3D from "../../components/sim-3d";

export const metadata: Metadata = {
  title: "SOZO 3D simulation: planetary rover simulator",
  description:
    "A planetary rover on real physics in your browser. Drive it on the Moon and Mars, float it in orbit, take it apart down to the pins. A design study: nothing has been built.",
};
export default function Page() {
  return <Sim3D />;
}
