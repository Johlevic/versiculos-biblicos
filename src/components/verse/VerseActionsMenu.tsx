import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "@/lib/domain/types";
import {
  buildVerseImageFilename,
  captureVerseBlobById,
  downloadVerseCaptureById,
} from "./DownloadButton";
import { showToast } from "@/lib/ui/toast";
import { BottomSheet } from "@/components/ui/BottomSheet";

type SanctuaryTheme = "celestial" | "nature";

function readSanctuaryTheme(): SanctuaryTheme {
  if (typeof window === "undefined") return "celestial";
  return localStorage.getItem("refugio-sanctuary") === "nature" ? "nature" : "celestial";
}

type Props = {
  captureElementId: string;
  lang: Lang;
  verseText: string;
  verseRef: string;
  disabled?: boolean;
  className?: string;
};

export function VerseActionsMenu({
  captureElementId,
  lang,
  verseText,
  verseRef,
  disabled,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [hAlign, setHAlign] = useState<"open-left" | "open-right">("open-left");
  const [vAlign, setVAlign] = useState<"up" | "down">("down");
  const [isMobile, setIsMobile] = useState(false);
  const [canCopyImage, setCanCopyImage] = useState(false);
  const [sanctuary, setSanctuary] = useState<SanctuaryTheme>("celestial");

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
    if (
      typeof window !== "undefined" &&
      navigator.clipboard &&
      typeof window.ClipboardItem !== "undefined"
    ) {
      setCanCopyImage(true);
    }
  }, []);

  const t = useMemo(
    () =>
      lang === "es"
        ? {
            actions: "Acciones del versículo",
            share: "Compartir",
            download: "Descargar PNG",
            copyImage: "Copiar imagen",
            copy: "Copiar texto",
            close: "Cerrar",
          }
        : {
            actions: "Verse actions",
            share: "Share",
            download: "Download PNG",
            copyImage: "Copy image",
            copy: "Copy text",
            close: "Close",
          },
    [lang],
  );

  const shareText = `“${verseText}” — ${verseRef}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    const onDown = (ev: MouseEvent) => {
      if (!boxRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    const anchor = boxRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const ar = anchor.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const spaceRight = window.innerWidth - ar.right;
    const spaceLeft = ar.left;
    const spaceBottom = window.innerHeight - ar.bottom;
    const spaceTop = ar.top;

    // Prefer opening to the left side when there is room (safer near right edge).
    setHAlign(spaceLeft >= pr.width ? "open-left" : "open-right");
    setVAlign(
      spaceBottom >= pr.height || spaceBottom >= spaceTop ? "down" : "up",
    );
  }, [open]);

  const copyVerse = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = shareText;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    ta.remove();
  };

  const onShare = async () => {
    setBusy(true);
    try {
      const blob = await captureVerseBlobById(captureElementId);
      if (blob && navigator.share) {
        const file = new File([blob], buildVerseImageFilename(verseRef), {
          type: "image/png",
        });
        const data = { files: [file], text: shareText, title: "BVerses" };
        if (navigator.canShare?.(data)) {
          await navigator.share(data);
          setOpen(false);
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ text: shareText, title: "BVerses" });
      } else {
        await copyVerse();
        showToast(
          lang === "es"
            ? "Texto copiado para compartir."
            : "Text copied for sharing.",
          "success",
          2200,
        );
      }
      setOpen(false);
    } catch {
      showToast(
        lang === "es"
          ? "No se pudo compartir. Intenta otra opción."
          : "Could not share. Try another option.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const DOWNLOAD_MODAL_DELAY_MS = 450;

  const onDownload = async () => {
    setBusy(true);
    setShowDownloadModal(false);
    setDownloadDone(false);
    setDownloadProgress(0);

    let downloadFinished = false;
    let progressUiShown = false;
    let progressTimer = 0;

    const successMsg = lang === "es" ? "Imagen descargada." : "Image saved.";

    const showModalTimer = window.setTimeout(() => {
      if (downloadFinished) return;
      progressUiShown = true;
      setShowDownloadModal(true);
      setDownloadProgress(1);
      progressTimer = window.setInterval(() => {
        setDownloadProgress((p) =>
          p < 92 ? p + Math.max(1, Math.round((92 - p) * 0.08)) : p,
        );
      }, 120);
    }, DOWNLOAD_MODAL_DELAY_MS);

    try {
      const ok = await downloadVerseCaptureById(
        captureElementId,
        buildVerseImageFilename(verseRef),
      );
      downloadFinished = true;
      window.clearTimeout(showModalTimer);
      if (progressTimer) {
        window.clearInterval(progressTimer);
        progressTimer = 0;
      }

      if (!ok) {
        setShowDownloadModal(false);
        showToast(
          lang === "es"
            ? "No se pudo generar la imagen."
            : "Could not generate image.",
          "error",
        );
      } else {
        if (progressUiShown) {
          setDownloadProgress(100);
          setDownloadDone(true);
          window.setTimeout(() => {
            setShowDownloadModal(false);
            setDownloadDone(false);
            setDownloadProgress(0);
            showToast(successMsg, "success", 2200);
          }, 700);
        } else {
          showToast(successMsg, "success", 2200);
        }
      }
      setOpen(false);
    } catch {
      downloadFinished = true;
      window.clearTimeout(showModalTimer);
      if (progressTimer) {
        window.clearInterval(progressTimer);
        progressTimer = 0;
      }
      setShowDownloadModal(false);
      setDownloadDone(false);
      setDownloadProgress(0);
      showToast(
        lang === "es"
          ? "Falló la descarga de la imagen."
          : "Image download failed.",
        "error",
      );
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setBusy(false);
    }
  };

  const onCopy = async () => {
    setBusy(true);
    try {
      await copyVerse();
      showToast(
        lang === "es"
          ? "Texto copiado al portapapeles."
          : "Text copied to clipboard.",
        "success",
        2200,
      );
      setOpen(false);
    } catch {
      showToast(
        lang === "es" ? "No se pudo copiar el texto." : "Could not copy text.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const onCopyImage = async () => {
    setBusy(true);
    try {
      const blob = await captureVerseBlobById(captureElementId);
      if (!blob) {
        showToast(
          lang === "es"
            ? "No se pudo generar la imagen."
            : "Could not generate image.",
          "error",
        );
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      showToast(
        lang === "es"
          ? "Imagen copiada al portapapeles."
          : "Image copied to clipboard.",
        "success",
        2200,
      );
      setOpen(false);
    } catch (err) {
      console.warn("Failed to copy image to clipboard:", err);
      showToast(
        lang === "es"
          ? "No se pudo copiar la imagen al portapapeles."
          : "Could not copy image to clipboard.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const d = Boolean(disabled || busy);

  // ── Theme-derived classes ──────────────────────────────────────────────
  const isNature = sanctuary === "nature";
  const dropdownBg = isNature
    ? "border-emerald-500/30 bg-[#081208]/95"
    : "border-gold-500/35 bg-[#0f1228]/95";
  const dropdownItemHover = isNature ? "hover:bg-emerald-500/10" : "hover:bg-gold-500/10";
  const dropdownIconColor = isNature ? "text-emerald-300/90" : "text-gold-300/90";
  const sheetItemBorder = isNature
    ? "border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10"
    : "border-gold-500/30 bg-gold-500/5 hover:bg-gold-500/10";
  const modalBg = isNature
    ? "border-emerald-500/25 bg-[#081208]/95"
    : "border-gold-500/30 bg-[#0f1228]/95";
  const progressBar = isNature
    ? "from-emerald-400 to-emerald-200"
    : "from-gold-400 to-gold-200";

  return (
    <div ref={boxRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={d}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.actions}
        title={t.actions}
        className="focus-ring inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-gold-500/55 bg-[#1e1508]/95 p-0 text-gold-300 shadow-[0_0_14px_rgba(212,175,55,0.28)] transition hover:border-gold-400 hover:bg-[#2d1f0d] disabled:cursor-wait disabled:opacity-60"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <g fill="#f5e206">
            <circle cx="10" cy="15" r="2" />
            <circle cx="10" cy="10" r="2" />
            <circle cx="10" cy="5" r="2" />
          </g>
        </svg>
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="menu"
          className={`absolute z-30 hidden min-w-[10.5rem] max-w-[calc(100vw-1rem)] rounded-xl border p-1.5 shadow-[0_0_18px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-colors duration-700 md:block ${dropdownBg} ${
            hAlign === "open-left"
              ? "md:right-0 md:left-auto"
              : "md:left-0 md:right-auto"
          } ${vAlign === "down" ? "top-12" : "bottom-12"}`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={onShare}
            disabled={d}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gold-100/95 transition disabled:opacity-60 ${dropdownItemHover}`}
          >
            <i className={`fa-solid fa-share-nodes w-4 ${dropdownIconColor}`} aria-hidden />
            {t.share}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onDownload}
            disabled={d}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gold-100/95 transition disabled:opacity-60 ${dropdownItemHover}`}
          >
            <i className={`fa-solid fa-download w-4 ${dropdownIconColor}`} aria-hidden />
            {t.download}
          </button>
          {canCopyImage ? (
            <button
              type="button"
              role="menuitem"
              onClick={onCopyImage}
              disabled={d}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gold-100/95 transition disabled:opacity-60 ${dropdownItemHover}`}
            >
              <i className={`fa-solid fa-file-image w-4 ${dropdownIconColor}`} aria-hidden />
              {t.copyImage}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={onCopy}
            disabled={d}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gold-100/95 transition disabled:opacity-60 ${dropdownItemHover}`}
          >
            <i className={`fa-solid fa-copy w-4 ${dropdownIconColor}`} aria-hidden />
            {t.copy}
          </button>
        </div>
      ) : null}
      <BottomSheet
        isOpen={open && isMobile}
        title={t.actions}
        onClose={() => setOpen(false)}
        closeLabel={t.close}
        maxHeightClassName="max-h-[68dvh] md:max-h-[82vh]"
        sanctuary={sanctuary}
      >
        <div className="w-[calc(100vw-2.5rem)] max-w-[28rem] space-y-2">
          <button
            type="button"
            role="menuitem"
            onClick={onShare}
            disabled={d}
            className={`flex w-full items-center gap-2 rounded-xl border px-4 py-4 text-left text-sm font-medium text-gold-100/95 transition disabled:opacity-60 ${sheetItemBorder}`}
          >
            <i className={`fa-solid fa-share-nodes w-4 ${dropdownIconColor}`} aria-hidden />
            {t.share}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onDownload}
            disabled={d}
            className={`flex w-full items-center gap-2 rounded-xl border px-4 py-4 text-left text-sm font-medium text-gold-100/95 transition disabled:opacity-60 ${sheetItemBorder}`}
          >
            <i className={`fa-solid fa-download w-4 ${dropdownIconColor}`} aria-hidden />
            {t.download}
          </button>
          {canCopyImage ? (
            <button
              type="button"
              role="menuitem"
              onClick={onCopyImage}
              disabled={d}
              className={`flex w-full items-center gap-2 rounded-xl border px-4 py-4 text-left text-sm font-medium text-gold-100/95 transition disabled:opacity-60 ${sheetItemBorder}`}
            >
              <i className={`fa-solid fa-file-image w-4 ${dropdownIconColor}`} aria-hidden />
              {t.copyImage}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={onCopy}
            disabled={d}
            className={`flex w-full items-center gap-2 rounded-xl border px-4 py-4 text-left text-sm font-medium text-gold-100/95 transition disabled:opacity-60 ${sheetItemBorder}`}
          >
            <i className={`fa-solid fa-copy w-4 ${dropdownIconColor}`} aria-hidden />
            {t.copy}
          </button>
        </div>
      </BottomSheet>

      {showDownloadModal && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[1px]">
              <div className={`w-full max-w-xs rounded-2xl border p-4 text-gold-100 shadow-[0_14px_40px_rgba(0,0,0,0.5)] transition-colors duration-700 ${modalBg}`}>
                <p className="text-center text-sm font-semibold">
                  {lang === "es"
                    ? "Descargando imagen..."
                    : "Downloading image..."}
                </p>

                {!downloadDone ? (
                  <>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-150 ${progressBar}`}
                        style={{ width: `${Math.max(2, downloadProgress)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-center text-xs text-gold-200/85">
                      {downloadProgress}%
                    </p>
                  </>
                ) : (
                  <div className="mt-3 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        fill="#06f520"
                        d="m10.6 13.8l-2.15-2.15q-.275-.275-.7-.275t-.7.275t-.275.7t.275.7L9.9 15.9q.3.3.7.3t.7-.3l5.65-5.65q.275-.275.275-.7t-.275-.7t-.7-.275t-.7.275zM12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
