import { useSyncExternalStore } from "react";
import { DEFAULT_ASSUMPTIONS, type Assumptions, type NodeId } from "./engine/types";

/**
 * The user's bar, kept on the device. This module is the only place that knows where
 * user state lives, so account sync can replace localStorage here without touching UI.
 */
export interface UserState {
  version: 1;
  /** Categories ticked directly. */
  owned: NodeId[];
  /** Bottle ids (from the catalog's bottle list) the user has added. */
  bottles: string[];
  /** Book ids the user owns; null means "all books". */
  books: string[] | null;
  assumptions: Assumptions;
}

const KEY = "cocktail-index:v1";
const DEFAULT: UserState = { version: 1, owned: [], bottles: [], books: null, assumptions: DEFAULT_ASSUMPTIONS };

let cached: UserState | null = null;
const listeners = new Set<() => void>();

function read(): UserState {
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<UserState>) : {};
    cached = { ...DEFAULT, ...saved, assumptions: { ...DEFAULT.assumptions, ...saved.assumptions } };
  } catch {
    cached = DEFAULT; // private mode or corrupt data: start fresh rather than crash
  }
  return cached;
}

function write(next: UserState) {
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: the session still works, it just won't persist
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cached = null; // another tab changed the bar
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function update(change: (s: UserState) => UserState) {
  const current = read();
  const next = change(current);
  if (next !== current) write(next);
}

export function useUserState(): [UserState, typeof update] {
  const state = useSyncExternalStore(subscribe, read, () => DEFAULT);
  return [state, update];
}
