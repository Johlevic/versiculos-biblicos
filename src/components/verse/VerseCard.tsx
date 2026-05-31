import type { Verse, Lang, Mood } from "@/lib/domain/types";
import {
  getClientVerseService,
  getSsgInitialVerse,
} from "@/lib/providers/verseServiceFactory";
import { displayCategory } from "@/lib/i18n/categories";
import { UI } from "@/lib/i18n/labels";
import { showToast } from "@/lib/ui/toast";
import { useCallback, useEffect, useState } from "react";
import { VerseCardView } from "./VerseCardView";
import { DownloadButton } from "./DownloadButton";
import { VerseActionsMenu } from "./VerseActionsMenu";

type SanctuaryTheme = "celestial" | "nature";

function readSanctuaryTheme(): SanctuaryTheme {
  if (typeof window === "undefined") return "celestial";
  const stored = localStorage.getItem("refugio-sanctuary");
  return stored === "nature" ? "nature" : "celestial";
}

const MOODS: Mood[] = [
  "all",
  "comfort",
  "wisdom",
  "hope",
  "love",
  "repentance",
];
const MOOD_SET = new Set<string>(MOODS);
const CAPTURE = "refugio-verse-capture";
const DAILY_KEY_PREFIX = "refugio.dailyVerseDate";

type Props = {
  initialFromBuild: Verse;
};

function parseMood(s: string | null): Mood {
  if (s && MOOD_SET.has(s) && s !== "all") return s as Mood;
  return s === "all" || !s ? "all" : (s as Mood) || "all";
}

function readUrl(): { lang: Lang; mood: Mood; hasQuery: boolean } {
  if (typeof window === "undefined") {
    return { lang: "es", mood: "all", hasQuery: false };
  }
  const q = new URLSearchParams(window.location.search);
  const lang: Lang = q.get("lang") === "en" ? "en" : "es";
  const mRaw = q.get("mood");
  const mood = mRaw && MOOD_SET.has(mRaw) ? parseMood(mRaw) : "all";
  return {
    lang,
    mood,
    hasQuery: window.location.search.length > 1,
  };
}

function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Client island: composes `VerseCard` (view) and `DownloadButton` with services + API.
 */
export function VerseCard({ initialFromBuild }: Props) {
  // Keep initial client render equal to server-rendered HTML to avoid hydration mismatch.
  const [verse, setVerse] = useState<Verse>(initialFromBuild);
  const [lang, setLang] = useState<Lang>(initialFromBuild.language ?? "es");
  const [mood, setMood] = useState<Mood>("all");
  const [loading, setLoading] = useState(false);
  const [urlDone, setUrlDone] = useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioSupported, setIsAudioSupported] = useState(true);
  const [sanctuary, setSanctuary] = useState<SanctuaryTheme>("celestial");

  const refresh = useCallback(async (L: Lang, M: Mood) => {
    setLoading(true);
    try {
      const s = getClientVerseService();
      const v = await s.getNextVerse(L, M);
      setVerse(v);
    } catch {
      setVerse(getSsgInitialVerse(L, M));
      showToast(
        L === "es"
          ? "No se pudo consultar la API. Mostrando respaldo local."
          : "API request failed. Showing local fallback.",
        "warning",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync sanctuary theme from localStorage + custom event
  useEffect(() => {
    setSanctuary(readSanctuaryTheme());
    const handler = (e: Event) => {
      const theme = (e as CustomEvent<{ theme: SanctuaryTheme }>).detail?.theme;
      if (theme === "celestial" || theme === "nature") setSanctuary(theme);
    };
    window.addEventListener("refugio-sanctuary-changed", handler);
    return () => window.removeEventListener("refugio-sanctuary-changed", handler);
  }, []);

  useEffect(() => {
    const { lang: L, mood: M, hasQuery } = readUrl();
    setLang(L);
    setMood(M);

    const dailyKey = `${DAILY_KEY_PREFIX}:${L}:${M}`;
    const today = getTodayKey();
    const storedDay =
      typeof window !== "undefined" ? localStorage.getItem(dailyKey) : null;
    const mustRefreshByDay = storedDay !== today;
    const shouldFetch = hasQuery || mustRefreshByDay;
    if (!shouldFetch) return;

    setUrlDone(false);
    void (async () => {
      setLoading(true);
      try {
        const s = getClientVerseService();
        const v = await s.getNextVerse(L, M);
        setVerse(v);
        localStorage.setItem(dailyKey, today);
      } catch {
        setVerse(getSsgInitialVerse(L, M));
        showToast(
          L === "es"
            ? "No se pudo consultar la API al cargar. Usando datos locales."
            : "API failed on load. Using local data.",
          "warning",
        );
        localStorage.setItem(dailyKey, today);
      } finally {
        setLoading(false);
        setUrlDone(true);
      }
    })();
  }, []);

  const onNew = useCallback(() => {
    if (!urlDone) return;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsAudioPlaying(false);
    }
    void refresh(lang, mood);
  }, [lang, mood, refresh, urlDone]);

  const onToggleSpeak = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      showToast(
        lang === "es"
          ? "Tu navegador no soporta lectura por voz."
          : "Your browser does not support text-to-speech.",
        "warning",
      );
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      `${verse.text}. ${verse.ref}`,
    );
    utterance.lang = lang === "es" ? "es-ES" : "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setIsAudioPlaying(false);
    utterance.onerror = () => {
      setIsAudioPlaying(false);
      showToast(
        lang === "es"
          ? "No se pudo reproducir el audio."
          : "Could not play audio.",
        "error",
      );
    };

    setIsAudioPlaying(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [lang, verse.ref, verse.text]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined";
    if (!supported) {
      setIsAudioSupported(false);
      showToast(
        lang === "es"
          ? "Tu dispositivo no soporta lectura por voz."
          : "Your device does not support text-to-speech.",
        "warning",
      );
    }
  }, [lang]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setIsAudioPlaying(false);
      }
    };
  }, []);

  const t = UI[lang];
  const tag = displayCategory(verse, lang, mood);

  return (
    <div className="w-full max-w-2xl px-2 sm:px-0">
      <VerseCardView
        verse={verse}
        lang={lang}
        categoryLabel={tag}
        onNewVerse={onNew}
        isLoading={loading || !urlDone}
        captureId={CAPTURE}
        titleLine={t.title}
        footerText={t.footer}
        sanctuary={sanctuary}
        actionSlot={
          <VerseActionsMenu
            captureElementId={CAPTURE}
            lang={lang}
            verseText={verse.text}
            verseRef={verse.ref}
            disabled={loading}
          />
        }
        audioSlot={
          isAudioSupported ? (
            <button
              type="button"
              onClick={onToggleSpeak}
              disabled={loading || isAudioPlaying}
              aria-label={lang === "es" ? "Escuchar versículo" : "Listen verse"}
              title={lang === "es" ? "Escuchar versículo" : "Listen verse"}
              className="focus-ring inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-gold-500/55 bg-[#1e1508]/95 p-0 text-gold-300 shadow-[0_0_14px_rgba(212,175,55,0.28)] transition hover:border-gold-400 hover:bg-[#2d1f0d] disabled:cursor-wait disabled:opacity-60"
            >
              <i className="fa-solid fa-volume-high text-base" aria-hidden />
            </button>
          ) : null
        }
        actionSlotDesktop={
          <DownloadButton
            captureElementId={CAPTURE}
            lang={lang}
            verseRef={verse.ref}
            disabled={loading}
          />
        }
      />
    </div>
  );
}
