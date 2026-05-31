import { useMemo, useState, type ReactNode } from "react";
import type { Lang, Verse } from "@/lib/domain/types";
import { labelsFor } from "@/lib/i18n/labels";
import { VerseRefCache } from "@/lib/cache/VerseRefCache";
import { BottomSheet } from "@/components/ui/BottomSheet";

const NT_BOOKS = new Set([
  "mateo",
  "marcos",
  "lucas",
  "juan",
  "hechos",
  "romanos",
  "1 corintios",
  "2 corintios",
  "galatas",
  "efesios",
  "filipenses",
  "colosenses",
  "1 tesalonicenses",
  "2 tesalonicenses",
  "1 timoteo",
  "2 timoteo",
  "tito",
  "filemon",
  "hebreos",
  "santiago",
  "1 pedro",
  "2 pedro",
  "1 juan",
  "2 juan",
  "3 juan",
  "judas",
  "apocalipsis",
  "matthew",
  "mark",
  "luke",
  "john",
  "acts",
  "romans",
  "1 corinthians",
  "2 corinthians",
  "galatians",
  "ephesians",
  "philippians",
  "colossians",
  "1 thessalonians",
  "2 thessalonians",
  "1 timothy",
  "2 timothy",
  "titus",
  "philemon",
  "hebrews",
  "james",
  "1 peter",
  "2 peter",
  "1 john",
  "2 john",
  "3 john",
  "jude",
  "revelation",
]);

function normalizeBookName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getBookFromRef(ref: string): string {
  const m = ref.match(/^(.*?)\s+\d+:\d+/);
  return normalizeBookName(m ? m[1] : ref);
}

function getTestamentLabel(ref: string, lang: Lang): string {
  const book = getBookFromRef(ref);
  const isNt = NT_BOOKS.has(book);
  if (lang === "es") return isNt ? "NT" : "AT";
  return isNt ? "NT" : "OT";
}

type Props = {
  verse: Verse;
  lang: Lang;
  categoryLabel: string;
  onNewVerse: () => void;
  isLoading: boolean;
  captureId: string;
  titleLine: string;
  footerText: string;
  sanctuary?: "celestial" | "nature";
  /** Móvil: icono de descarga (esquina del card) */
  actionSlot?: ReactNode;
  /** Móvil/desktop: icono de audio (esquina opuesta al menú) */
  audioSlot?: ReactNode;
  /** PC/tablet: botón de descarga con texto en la fila con “Nuevo versículo” */
  actionSlotDesktop?: ReactNode;
};

type DevotionAction = "meditate" | "pray" | "reflect";

export function VerseCardView({
  verse,
  lang,
  categoryLabel,
  onNewVerse,
  isLoading,
  captureId,
  titleLine,
  footerText,
  sanctuary = "celestial",
  actionSlot,
  audioSlot,
  actionSlotDesktop,
}: Props) {
  const [devotionOpen, setDevotionOpen] = useState<DevotionAction | null>(null);
  const cache = new VerseRefCache();
  const n = cache.getRecentRefs().length;
  const L = labelsFor(lang);
  const isLongVerse = verse.text.length > 170 || /\n/.test(verse.text);

  // ── Theme-dependent styles ──────────────────────────────────────────────
  const isNature = sanctuary === "nature";
  const articleMdBg = isNature
    ? "md:from-[#0d1a0f]/95 md:to-[#0a1208]/60"
    : "md:from-[#12132a]/95 md:to-night/50";
  const articleMdBorder = isNature ? "md:border-emerald-500/10" : "md:border-gold-500/10";
  const captureMdBg = isNature ? "md:bg-[#0d1a0f]/25" : "md:bg-black/20";
  const captureMdBorder = isNature ? "md:border-emerald-500/5" : "md:border-gold-500/5";
  const captureMobileBg = isNature
    ? "max-md:bg-[#0f2212]/50 max-md:border-emerald-400/20 max-md:shadow-[0_0_10px_rgba(52,211,153,0.08)]"
    : "max-md:bg-[#1f1634]/40 max-md:border-gold-500/20 max-md:shadow-[0_0_10px_rgba(212,175,55,0.1)]";
  const articleMobileBg = isNature
    ? "max-md:border-[#4ade80]/25 max-md:bg-[#0f1f12]/20"
    : "max-md:border-[#a6823a]/40 max-md:bg-slate-950/15";
  const doveSizeClass = isLongVerse
    ? "h-[5.5rem] w-[5.5rem] md:h-32 md:w-32"
    : "h-[5.5rem] w-[5.5rem] md:h-24 md:w-24";
  /** Grid track must fit the dove on md+ so the image does not spill into the verse column. */
  const doveGridColClass = isLongVerse
    ? "md:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]"
    : "md:grid-cols-[minmax(0,6rem)_minmax(0,1fr)]";
  const doveColWidthClass = isLongVerse ? "md:w-32" : "md:w-24";
  const sourceLine =
    lang === "es"
      ? verse.source === "api-bible"
        ? "La Biblia de las Americas (LBLA)"
        : verse.source === "bible-api"
          ? "World English Bible (WEB)"
          : "Reina-Valera 1960 (RVR60)"
      : verse.source === "api-bible"
        ? "Source: La Biblia de las Americas (LBLA)"
        : verse.source === "bible-api"
          ? "World English Bible (WEB)"
          : "Source: Reina-Valera 1960 (RVR60)";
  const testamentLabel = getTestamentLabel(verse.ref, lang);
  const devotionCopy = useMemo(() => {
    const shared = {
      meditate:
        lang === "es"
          ? {
              label: "Medita",
              title: "Medita en su verdad",
              body: `Lee ${verse.ref} en silencio y pregúntate: ¿qué verdad de Dios necesito creer hoy para caminar en paz?`,
            }
          : {
              label: "Meditate",
              title: "Meditate on His truth",
              body: `Read ${verse.ref} slowly and ask: what truth about God do I need to believe today to walk in peace?`,
            },
      pray:
        lang === "es"
          ? {
              label: "Ora",
              title: "Ora con esperanza",
              body: `Señor, gracias por tu Palabra en ${verse.ref}. Fortalece mi fe y dirige mis pasos hoy. Amén.`,
            }
          : {
              label: "Pray",
              title: "Pray with hope",
              body: `Lord, thank You for Your Word in ${verse.ref}. Strengthen my faith and guide my steps today. Amen.`,
            },
      reflect:
        lang === "es"
          ? {
              label: "Reflexiona",
              title: "Reflexiona y actúa",
              body: `Elige una acción concreta para hoy inspirada en este versículo y compártela con alguien que necesite ánimo.`,
            }
          : {
              label: "Reflect",
              title: "Reflect and act",
              body: `Choose one concrete action for today inspired by this verse and share encouragement with someone who needs it.`,
            },
      close: lang === "es" ? "Cerrar" : "Close",
    };
    return shared;
  }, [lang, verse.ref]);

  return (
    <article
      className={`group relative z-10 mx-auto w-full max-w-2xl overflow-visible border px-2 py-8 transition-colors duration-700 max-md:min-h-0 max-md:rounded-2xl max-md:border-[0.5px] max-md:shadow-none md:rounded-2xl md:bg-gradient-to-b md:px-6 md:py-6 md:shadow-[0_0_24px_rgba(0,0,0,0.28)] ${articleMobileBg} ${articleMdBg} ${articleMdBorder}`}
    >
      {audioSlot ? (
        <div className="absolute left-3 top-3 z-20 max-md:hidden">
          {audioSlot}
        </div>
      ) : null}
      {actionSlot ? (
        <div className="absolute right-3 top-3 z-20 max-md:hidden">
          {actionSlot}
        </div>
      ) : null}

      <div className="relative mb-3 flex w-full items-center justify-center sm:mb-3">
        <p className="flex w-full justify-center max-md:px-12">
          <span className="inline-flex max-w-[calc(100vw-8.5rem)] items-center justify-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-center font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-400 sm:max-w-none">
            <i
              className="fa-solid fa-book-bible me-1.5 shrink-0 opacity-80"
              aria-hidden
            />
            <span className="truncate">{categoryLabel}</span>
          </span>
        </p>
        {audioSlot ? (
          <div className="absolute left-0 top-1/2 z-20 -translate-y-1/2 md:hidden">
            {audioSlot}
          </div>
        ) : null}
        {actionSlot ? (
          <div className="absolute right-0 top-1/2 z-20 -translate-y-1/2 md:hidden">
            {actionSlot}
          </div>
        ) : null}
      </div>

      <div
        id={captureId}
        className={`capture-root relative overflow-hidden bg-black/0 px-1 py-2 transition-colors duration-700 max-md:rounded-2xl max-md:border max-md:px-3 max-md:py-5 md:rounded-lg md:border md:px-5 md:py-5 ${captureMobileBg} ${captureMdBg} ${captureMdBorder}`}
      >
        <div className="relative z-10">
          <div className="mb-2 flex items-center justify-center gap-2 text-gold-400 sm:mb-3 sm:gap-3">
            <h2 className="w-full text-center font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold-200 sm:text-base md:text-base max-md:text-[#f7d97e] max-md:[text-shadow:0_0_10px_rgba(212,175,55,0.35)]">
              {titleLine}
            </h2>
          </div>

          <div
            className={`grid grid-cols-1 items-center gap-2 md:items-start md:gap-x-1.5 md:gap-y-0 ${doveGridColClass}`}
          >
            <div
              className={`mx-auto flex w-full shrink-0 justify-center md:mx-0 md:h-full md:min-h-0 md:self-stretch md:items-center md:justify-center ${doveColWidthClass}`}
            >
              <img
                src="/img/paloma-perfil.png"
                alt=""
                aria-hidden="true"
                className={`${doveSizeClass} object-contain opacity-90`}
                loading="lazy"
              />
            </div>
            <div className="isolate flex min-w-0 flex-col gap-3 sm:gap-4 md:gap-5 md:pl-0">
              <p className="text-center text-base font-normal leading-relaxed text-gold-100/95 sm:text-2xl md:text-xl md:pb-2 md:leading-[1.55] max-md:px-1 max-md:py-2 max-md:text-[1.05rem] max-md:font-medium max-md:leading-8 max-md:text-[#f8e4ae]">
                “{verse.text}”
              </p>
              <p className="shrink-0 text-center font-display text-sm leading-normal text-gold-500 sm:text-base md:hidden max-md:mt-0 max-md:text-[#f2cb5d] max-md:[text-shadow:0_0_8px_rgba(212,175,55,0.25)]">
                {verse.ref} · {testamentLabel}
              </p>
            </div>
          </div>
          <p className="mt-2 hidden text-center font-display text-sm leading-normal text-gold-500 md:block md:text-sm">
            {verse.ref} · {testamentLabel}
          </p>
        </div>
        <div className="relative z-10 mt-3 flex w-full items-center justify-center gap-2 text-gold-500/50 sm:mt-4">
          <span className="h-px max-w-[40%] flex-1 bg-gradient-to-r from-transparent to-gold-500/30" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden
            className="opacity-85"
          >
            <path
              fill="currentColor"
              d="M20.7 3.3a1 1 0 0 0-1.4 0L7.6 15a5 5 0 0 0-1.4 3.1L6 20a1 1 0 0 0 1 1l1.9-.2A5 5 0 0 0 12 19.4L23.7 7.7a1 1 0 0 0 0-1.4zm-9.8 14.7a3 3 0 0 1-1.8.8l-1 .1.1-1a3 3 0 0 1 .8-1.8l7.1-7.1 1.9 1.9z"
            />
          </svg>
          <span className="h-px max-w-[40%] flex-1 bg-gradient-to-l from-transparent to-gold-500/30" />
        </div>
        <div className="relative z-10 mt-2 flex flex-wrap items-center justify-center gap-2 sm:mt-3">
          <button
            type="button"
            onClick={() => setDevotionOpen("meditate")}
            className="focus-ring rounded-md px-1.5 bg-transparent py-0 text-xs font-semibold text-gold-300/80 transition hover:text-gold-200"
          >
            {devotionCopy.meditate.label}
          </button>
          <span className="text-xs text-gold-500/60" aria-hidden>
            •
          </span>
          <button
            type="button"
            onClick={() => setDevotionOpen("pray")}
            className="focus-ring rounded-md px-1.5 bg-transparent py-0 text-xs font-semibold text-gold-300/80 transition hover:text-gold-200"
          >
            {devotionCopy.pray.label}
          </button>
          <span className="text-xs text-gold-500/60" aria-hidden>
            •
          </span>
          <button
            type="button"
            onClick={() => setDevotionOpen("reflect")}
            className="focus-ring rounded-md px-1.5 bg-transparent py-0 text-xs font-semibold text-gold-300/80 transition hover:text-gold-200"
          >
            {devotionCopy.reflect.label}
          </button>
        </div>
        <p className="relative z-10 mt-2 text-right font-sans text-[11px] text-gold-400/55 sm:text-xs">
          {sourceLine}
        </p>
      </div>

      <div className="mt-4 hidden w-full max-w-md flex-col items-stretch gap-3 sm:mt-5 sm:mx-auto sm:flex sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4">
        <button
          type="button"
          onClick={onNewVerse}
          disabled={isLoading}
          className="focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-gold-500/50 bg-gold-500/15 px-4 py-2.5 text-sm font-semibold text-gold-200 transition hover:border-gold-400 hover:bg-gold-500/25 sm:max-w-xs sm:flex-initial sm:px-6 disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? (
            <i className="fa-solid fa-spinner fa-spin" aria-hidden />
          ) : (
            <i className="fa-solid fa-rotate" aria-hidden />
          )}
          {L.newVerse}
        </button>
        {actionSlotDesktop}
      </div>

      <div className="mt-4 flex w-full sm:hidden">
        <button
          type="button"
          onClick={onNewVerse}
          disabled={isLoading}
          className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gold-500/50 bg-gold-500/15 px-4 py-2.5 text-sm font-semibold text-gold-200 transition hover:border-gold-400 hover:bg-gold-500/25 disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? (
            <i className="fa-solid fa-spinner fa-spin" aria-hidden />
          ) : (
            <i className="fa-solid fa-rotate" aria-hidden />
          )}
          {L.newVerse}
        </button>
      </div>

      <p className="mt-3 text-center font-sans text-xs text-gold-300/50 sm:mt-4">
        <i className="fa-solid fa-clock-rotate-left me-1" aria-hidden />
        <span suppressHydrationWarning>{L.counter(n)}</span>
      </p>

      {devotionOpen ? (
        <BottomSheet
          isOpen={Boolean(devotionOpen)}
          title={devotionCopy[devotionOpen].title}
          onClose={() => setDevotionOpen(null)}
          closeLabel={devotionCopy.close}
          bodyBackgroundImageUrl="/img/paloma-perfil-fondo.jpg"
          panelClassName="md:max-w-2xl"
          sanctuary={sanctuary}
          footer={
            <button
              type="button"
              onClick={() => setDevotionOpen(null)}
              className="inline-flex min-h-9 w-full items-center justify-center rounded-full border border-gold-400/65 bg-gold-500/16 px-4 text-xs font-semibold text-gold-100 transition hover:border-gold-300 hover:bg-gold-500/25 md:w-auto md:px-5"
            >
              {devotionCopy.close}
            </button>
          }
        >
          <p className="max-w-2xl text-base leading-relaxed text-gold-50 md:text-lg md:leading-relaxed">
            {devotionCopy[devotionOpen].body}
          </p>
        </BottomSheet>
      ) : null}
    </article>
  );
}
