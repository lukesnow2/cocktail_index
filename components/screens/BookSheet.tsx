"use client";

import { useEffect } from "react";
import { useApp } from "@/components/AppProvider";
import { BookList } from "@/components/screens/BooksScreen";
import { Button } from "@/components/ui/Button";

/** The book filter on Drinks: the same BookRow list as the Books screen, in a sheet. */
export function BookSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!app) return null;
  return (
    <>
      <div className="ci-sheet-backdrop" onClick={onClose} />
      <div className="ci-sheet" role="dialog" aria-modal="true" aria-label="Books">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <div className="ci-header">
            <h2 className="title-section">Your books</h2>
            <Button variant="quiet" compact onClick={onClose}>
              Done
            </Button>
          </div>
          <BookList />
        </div>
      </div>
    </>
  );
}
