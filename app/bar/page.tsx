import type { Metadata } from "next";
import { BarScreen } from "@/components/screens/BarScreen";

export const metadata: Metadata = { title: "My Bar · Cocktail Index" };

export default function Page() {
  return <BarScreen />;
}
