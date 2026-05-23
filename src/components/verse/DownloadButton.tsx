import { useState } from "react";
import type { Lang } from "@/lib/domain/types";
import { UI } from "@/lib/i18n/labels";
import { showToast } from "@/lib/ui/toast";
import { toBlob as htmlToImageBlob, toPng as htmlToImagePng } from "html-to-image";
import html2canvas from "html2canvas";

type Props = {
  captureElementId: string;
  lang: Lang;
  verseRef?: string;
  /** When the verse is refreshing, also disable. */
  disabled?: boolean;
  iconOnlyMobile?: boolean;
  className?: string;
};

const PNG_FILE = "refugio-celestial-versiculo.png";

export function buildVerseImageFilename(ref?: string): string {
  const base = (ref ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return base ? `versiculo-${base}.png` : PNG_FILE;
}

function triggerDownload(url: string, filename: string): boolean {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

function openImageForManualSave(url: string): boolean {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

function isLikelyIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isLikelyMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) ||
    navigator.maxTouchPoints > 1;
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const direct = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png", 1)
  );
  if (direct) return direct;

  try {
    const dataUrl = canvas.toDataURL("image/png", 1);
    const marker = ";base64,";
    const idx = dataUrl.indexOf(marker);
    if (idx < 0) return null;
    const b64 = dataUrl.slice(idx + marker.length);
    const mime = dataUrl.slice(5, idx);
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime || "image/png" });
  } catch {
    return null;
  }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const marker = ";base64,";
    const idx = dataUrl.indexOf(marker);
    if (idx < 0) return null;
    const b64 = dataUrl.slice(idx + marker.length);
    const mime = dataUrl.slice(5, idx);
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime || "image/png" });
  } catch {
    return null;
  }
}

export async function captureVerseBlobById(
  captureElementId: string
): Promise<Blob | null> {
  const el = document.getElementById(captureElementId);
  if (!el) return null;

  const node = el as HTMLElement;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const rect = node.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return null;

  if ("fonts" in document) {
    await document.fonts.ready;
  }

  // Primary engine: html-to-image (worked better previously in this app).
  try {
    const common = {
      cacheBust: true,
      pixelRatio: Math.min(2.2, (window.devicePixelRatio || 1) * 1.25),
      backgroundColor: "#12132a",
    };
    const runHtmlToImage = async (skipFonts: boolean): Promise<Blob | null> => {
      const opts = { ...common, skipFonts };
      const directBlob = await htmlToImageBlob(node, opts);
      if (directBlob) return directBlob;

      const dataUrl = await htmlToImagePng(node, opts);
      return dataUrlToBlob(dataUrl);
    };

    // First try: keep typography equal to screen by embedding fonts.
    const firstBlob = await runHtmlToImage(false);
    if (firstBlob) return firstBlob;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRemoteCssSecurityError =
      msg.includes("cssRules") || msg.includes("SecurityError") || msg.includes("Error inlining remote css file");

    // Google Fonts stylesheets can block cssRules access on some browsers; retry without reading remote font rules.
    if (isRemoteCssSecurityError) {
      try {
        const fallbackBlob = await htmlToImageBlob(node, {
          cacheBust: true,
          pixelRatio: Math.min(2.2, (window.devicePixelRatio || 1) * 1.25),
          backgroundColor: "#12132a",
          skipFonts: true,
        });
        if (fallbackBlob) return fallbackBlob;

        const fallbackPng = await htmlToImagePng(node, {
          cacheBust: true,
          pixelRatio: Math.min(2.2, (window.devicePixelRatio || 1) * 1.25),
          backgroundColor: "#12132a",
          skipFonts: true,
        });
        const fallbackDataBlob = dataUrlToBlob(fallbackPng);
        if (fallbackDataBlob) return fallbackDataBlob;
      } catch (retryErr) {
        console.warn("html-to-image fallback (skipFonts) failed", retryErr);
      }
    }

    console.warn("html-to-image capture failed", err);
  }

  // Secondary fallback: html2canvas.
  try {
    const canvas = await html2canvas(node, {
      scale: Math.min(2.2, (window.devicePixelRatio || 1) * 1.25),
      backgroundColor: "#12132a",
      useCORS: true,
      allowTaint: false,
      logging: false,
    });
    return await canvasToPngBlob(canvas);
  } catch (err) {
    console.warn("html2canvas fallback failed", err);
  }
  return null;
}

export async function downloadVerseCaptureById(
  captureElementId: string,
  filename = PNG_FILE
): Promise<boolean> {
  const blob = await captureVerseBlobById(captureElementId);
  if (!blob) return false;

  const objectUrl = URL.createObjectURL(blob);

  if (isLikelyMobileDevice()) {
    // Try normal download first on mobile to mimic desktop behavior.
    const started = triggerDownload(objectUrl, filename);
    if (started) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return true;
    }
    // Fallback only if mobile download is blocked.
    const opened = openImageForManualSave(objectUrl);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return opened;
  }

  // iOS/PWA often blocks programmatic downloads; opening the PNG is more reliable there.
  if (isLikelyIOS()) {
    openImageForManualSave(objectUrl);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return true;
  }

  const started = triggerDownload(objectUrl, filename);
  if (!started) {
    openImageForManualSave(objectUrl);
  }

  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return true;
}

/**
 * Renders a button that exports the verse card area as a PNG (client-side).
 */
export function DownloadButton({
  captureElementId,
  lang,
  verseRef,
  disabled,
  iconOnlyMobile = false,
  className = "",
}: Props) {
  const L = UI[lang];
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      const ok = await downloadVerseCaptureById(
        captureElementId,
        buildVerseImageFilename(verseRef)
      );
      if (!ok) {
        showToast(
          lang === "es"
            ? "No se pudo generar la imagen."
            : "Could not generate image.",
          "error"
        );
      }
    } catch {
      showToast(
        lang === "es"
          ? "Falló la descarga de la imagen. Intenta nuevamente."
          : "Image download failed. Please try again.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const d = Boolean(disabled || busy);

  return (
    <button
      type="button"
      onClick={handle}
      disabled={d}
      aria-label={L.download}
      title={L.download}
      className={`inline-flex items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/5 text-sm font-semibold text-gold-200/90 transition hover:border-gold-500/50 hover:bg-gold-500/10 disabled:cursor-wait disabled:opacity-60 ${
        iconOnlyMobile ? "min-h-10 min-w-10 p-0" : "min-h-11 gap-2 px-4 py-2.5"
      } ${className}`.trim()}
    >
      {busy ? (
        <i className="fa-solid fa-spinner fa-spin" aria-hidden />
      ) : iconOnlyMobile ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            fill="#f5e206"
            d="M5 20h14v-2H5zM19 9h-4V3H9v6H5l7 7z"
          />
        </svg>
      ) : (
        <i className="fa-solid fa-image" aria-hidden />
      )}
      {!iconOnlyMobile && L.download}
      {iconOnlyMobile && <span className="sr-only">{L.download}</span>}
    </button>
  );
}
