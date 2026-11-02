import { useEffect, useRef } from "react";

const PARTICLES = Array.from({ length: 16 }, (_, index) => ({
  x: Math.cos(index * 2.39996) * (36 + index % 4 * 8),
  y: Math.sin(index * 2.39996) * (36 + index % 4 * 8),
  delay: index * -0.73,
}));

export default function NeoCore({ state, meter, paused, reducedMotion, modestDevice }) {
  const rootRef = useRef(null);
  const reactive = (state === "listening" || state === "speaking") && meter?.available;
  const levelRef = meter?.levelRef;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame;
    let previous = 0;
    const reset = () => {
      root.style.setProperty("--neo-energy", "0");
      root.style.setProperty("--neo-audio-scale", "1");
      root.style.setProperty("--neo-wave-scale", "1");
    };
    reset();
    if (!reactive || paused || reducedMotion) return;
    const animate = (time) => {
      if (time - previous >= (modestDevice ? 64 : 32)) {
        const energy = Math.max(0, Math.min(1, levelRef?.current || 0));
        root.style.setProperty("--neo-energy", energy.toFixed(3));
        root.style.setProperty("--neo-audio-scale", (1 + energy * 0.065).toFixed(3));
        root.style.setProperty("--neo-wave-scale", (1 + energy * 0.22).toFixed(3));
        previous = time;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); reset(); };
  }, [reactive, paused, reducedMotion, modestDevice, levelRef]);

  return (
    <div ref={rootRef} className="neo-core-scene" data-state={state} data-reactive={Boolean(reactive)} aria-hidden="true">
      <div className="neo-core-aura" />
      <div className="neo-core-floor" />
      <div className="neo-orbit neo-orbit-outer"><span /></div>
      <div className="neo-orbit neo-orbit-middle"><span /></div>
      <div className="neo-orbit neo-orbit-inner"><span /></div>
      <div className="neo-signal-wave neo-signal-wave-one" />
      <div className="neo-signal-wave neo-signal-wave-two" />
      <div className="neo-sphere-energy">
        <div className="neo-sphere">
          <div className="neo-sphere-depth" />
          <svg className="neo-sphere-field" viewBox="0 0 300 300" fill="none">
            <ellipse cx="150" cy="150" rx="131" ry="57" />
            <ellipse cx="150" cy="150" rx="131" ry="95" />
            <ellipse cx="150" cy="150" rx="57" ry="131" />
            <ellipse cx="150" cy="150" rx="95" ry="131" />
            <path d="M21 150h258M150 19v262" />
          </svg>
          <div className="neo-inner-orbit neo-inner-orbit-one" />
          <div className="neo-inner-orbit neo-inner-orbit-two" />
          <div className="neo-inner-orbit neo-inner-orbit-three" />
          <div className="neo-nucleus-halo" />
          <div className="neo-nucleus"><span /><i /></div>
          <div className="neo-sphere-reflection" />
          <div className="neo-sphere-rim" />
        </div>
      </div>
      <div className="neo-particles">{PARTICLES.slice(0, modestDevice ? 6 : 16).map((particle, index) => (
        <span key={index} style={{ "--px": particle.x / 100, "--py": particle.y / 100, "--delay": `${particle.delay}s` }} />
      ))}</div>
    </div>
  );
}
