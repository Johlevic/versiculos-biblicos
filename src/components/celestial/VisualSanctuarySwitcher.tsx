import { useEffect, useState } from "react";
import { showToast } from "@/lib/ui/toast";

type Theme = "celestial" | "nature";

const LS_KEY = "refugio-celestial:sanctuary-theme";

export default function VisualSanctuarySwitcher() {
  const [theme, setTheme] = useState<Theme>("celestial");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LS_KEY) as Theme | null;
      if (stored === "nature" || stored === "celestial") {
        setTheme(stored);
        // Synchronously dispatch once to align background with storage on mount
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("refugio-sanctuary-changed", {
              detail: { theme: stored },
            })
          );
        }, 30);
      }
    }
  }, []);

  const toggle = () => {
    const next: Theme = theme === "celestial" ? "nature" : "celestial";
    setTheme(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, next);
      window.dispatchEvent(
        new CustomEvent("refugio-sanctuary-changed", {
          detail: { theme: next },
        })
      );

      // Informative soft toast
      showToast(
        next === "nature"
          ? "Santuario: Bosque de Meditación"
          : "Santuario: Noche Celestial",
        "success",
        1800
      );
    }
  };

  if (!mounted) return null;

  const titleText =
    theme === "celestial"
      ? "Cambiar a Santuario Bosque"
      : "Cambiar a Santuario Celestial";

  return (
    <div className="fixed bottom-4 left-4 z-40 sm:bottom-6 sm:left-6">
      <button
        type="button"
        onClick={toggle}
        aria-label={titleText}
        title={titleText}
        className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/40 bg-black/45 text-gold-300 shadow-[0_0_15px_rgba(212,175,55,0.22)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-gold-400 hover:text-gold-100 hover:shadow-[0_0_20px_rgba(212,175,55,0.35)] active:scale-95"
      >
        {theme === "celestial" ? (
          <i className="fa-solid fa-moon text-base transition-transform duration-500 rotate-0" aria-hidden="true" />
        ) : (
          <i className="fa-solid fa-leaf text-base transition-transform duration-500 scale-100 text-emerald-400" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
