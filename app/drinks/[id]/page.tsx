import { Suspense } from "react";
import { DrinkScreen } from "@/components/screens/DrinkScreen";

export default async function Page({ params }: PageProps<"/drinks/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <DrinkScreen id={decodeURIComponent(id)} />
    </Suspense>
  );
}
