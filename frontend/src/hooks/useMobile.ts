/**
 * Single shared mobile detection hook.
 * All components import this instead of useMediaQuery directly.
 */
import { useMediaQuery } from "./useMediaQuery";

export function useMobile() {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");
  return { isMobile, isTablet };
}
