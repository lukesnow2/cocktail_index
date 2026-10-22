import type { Metadata } from "next";
import { BuyScreen } from "@/components/screens/BuyScreen";

export const metadata: Metadata = { title: "Buy Next · Cocktail Index" };

export default function Page() {
  return <BuyScreen />;
}
