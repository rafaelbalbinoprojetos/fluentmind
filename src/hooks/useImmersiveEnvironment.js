import { useEffect, useState } from "react";

export default function useImmersiveEnvironment(rootRef) {
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false);
  const modestDevice = navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(Boolean(media?.matches));
    const onVisibility = () => setHidden(document.hidden);
    const viewport = window.visualViewport;
    const onViewport = () => {
      const root = rootRef.current;
      if (!root) return;
      root.style.setProperty("--neo-vh", `${viewport?.height || window.innerHeight}px`);
      root.style.setProperty("--neo-vtop", `${viewport?.offsetTop || 0}px`);
      root.dataset.keyboard = viewport && viewport.height < window.innerHeight * 0.75 ? "true" : "false";
    };
    media?.addEventListener?.("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    viewport?.addEventListener("resize", onViewport);
    viewport?.addEventListener("scroll", onViewport);
    window.addEventListener("resize", onViewport);
    onViewport();
    return () => {
      media?.removeEventListener?.("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      viewport?.removeEventListener("resize", onViewport);
      viewport?.removeEventListener("scroll", onViewport);
      window.removeEventListener("resize", onViewport);
    };
  }, [rootRef]);

  return { hidden, reducedMotion, modestDevice: Boolean(modestDevice) };
}
