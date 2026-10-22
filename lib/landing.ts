import { useEffect, useRef } from "react";

// Which screen the app opened on. First run opens on My Bar only when the app itself
// opened on Drinks: landing on Books (or a shared drink link) and then tapping Drinks
// should show the Drinks empty state, not bounce you away.
let landed = false;

/** Every screen calls this; the first to mount in the session is the landing screen. */
export function useLanding(): React.RefObject<boolean> {
  const isLanding = useRef(false);
  useEffect(() => {
    isLanding.current = !landed;
    landed = true;
  }, []);
  return isLanding;
}
