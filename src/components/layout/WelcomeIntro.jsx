import { useEffect, useState } from "react";

// Full-screen intro shown right after login, on a white background:
// 1. "CRM" writes itself in black cursive.
// 2. The tagline zooms in from large to its normal size.
// 3. The white screen fades away to reveal the dashboard underneath.
const SHOW_TIME = 3600; // ms: writing + tagline zoom + a short pause (click or any key skips it)
const FADE_TIME = 600; // ms: how long the fade-out takes

export default function WelcomeIntro({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const showTime = reduceMotion ? 800 : SHOW_TIME;

    const fadeTimer = setTimeout(() => setLeaving(true), showTime);
    let doneTimer = setTimeout(() => onDone(), showTime + FADE_TIME);

    // Click, tap or any key: skip straight to the dashboard
    function skip() {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      setLeaving(true);
      doneTimer = setTimeout(() => onDone(), 250);
    }
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [onDone]);

  return (
    <div
      role="status"
      aria-label="Loading your dashboard"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 text-center transition-opacity duration-[600ms] ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <p className="font-script text-8xl font-bold text-gray-900 animate-write motion-reduce:animate-none sm:text-9xl">
        CRM
      </p>
      <p className="mt-4 text-lg font-medium text-gray-600 animate-zoom-settle motion-reduce:animate-none sm:text-xl">
        All your leads in one place
      </p>
    </div>
  );
}
