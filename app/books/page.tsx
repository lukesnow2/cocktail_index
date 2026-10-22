import type { Metadata } from "next";
import { BooksScreen } from "@/components/screens/BooksScreen";

export const metadata: Metadata = { title: "Books · Cocktail Index" };

export default function Page() {
  return <BooksScreen />;
}
