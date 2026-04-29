"use client";

import { Button } from "@/components/ui/button";
import {
  AppNotice,
  AppSurface,
  secondaryActionClassName,
} from "@/components/ui/appSurface";
import { collectDisplayDesignUrls } from "@/lib/designPageGeneration";
import type { ChatMessage, SessionStatus } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AdminSessionSummary = {
  id: string;
  created_at: string;
  updated_at: string;
  status: SessionStatus;
  product: string | null;
  product_color: string | null;
  quantity: number | null;
  event_type: string | null;
  style: string | null;
  summary: string;
  thumbnail_url: string | null;
  design_count: number;
  has_designs: boolean;
  has_chat: boolean;
  slogan_count: number;
};

type AdminSessionDetail = AdminSessionSummary & {
  conversation_history: ChatMessage[];
  onboarding_data: unknown;
  product_selection: unknown;
  creative_brief: unknown;
  prompt_data: unknown;
  design_urls: string[];
  design_assets: unknown[];
  reference_images: Array<{
    url?: string;
    description?: string | null;
    storage_path?: string;
  }>;
  slogans: Array<{ main_text?: string; sub_text?: string | null }>;
  selected_design_url: string | null;
  selected_slogan: unknown;
  config: unknown;
};

type MediaItem = {
  url: string;
  label: string;
  description: string;
  kind: "design" | "reference";
};

type LightboxTab = "chat" | "infos" | "slogans" | "technik";

const lightboxTabs: Array<{ id: LightboxTab; label: string }> = [
  { id: "chat", label: "Chat" },
  { id: "infos", label: "Infos" },
  { id: "slogans", label: "Slogans" },
  { id: "technik", label: "Technik" },
];

const ADMIN_REFERENCE_PREVIEW_CLICK_ZOOM_SCALE = 1.25;
const ADMIN_DESIGN_PREVIEW_MIN_CLICK_ZOOM_SCALE = 1.35;
const ADMIN_PREVIEW_MAX_ZOOM_SCALE = 2;
const ADMIN_PREVIEW_WHEEL_ZOOM_STEP = 0.1;

function clampAdminPreviewZoomScale(scale: number) {
  return Math.min(ADMIN_PREVIEW_MAX_ZOOM_SCALE, Math.max(1, Number(scale.toFixed(2))));
}

function clampAdminPreviewPanOffset(
  offset: { x: number; y: number },
  scale: number,
  previewFrameElement: HTMLElement
) {
  const bounds = previewFrameElement.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return offset;
  const maxX = (bounds.width * (scale - 1)) / 2;
  const maxY = (bounds.height * (scale - 1)) / 2;
  return {
    x: Number(Math.min(maxX, Math.max(-maxX, offset.x)).toFixed(2)),
    y: Number(Math.min(maxY, Math.max(-maxY, offset.y)).toFixed(2)),
  };
}

function getAdminPreviewClickZoomScale(
  item: MediaItem,
  previewFrameElement: HTMLElement,
  previewImageElement: HTMLImageElement | null
) {
  if (item.kind !== "design") return ADMIN_REFERENCE_PREVIEW_CLICK_ZOOM_SCALE;

  const frameBounds = previewFrameElement.getBoundingClientRect();
  const imageBounds = previewImageElement?.getBoundingClientRect();
  if (
    !imageBounds ||
    frameBounds.width <= 0 ||
    frameBounds.height <= 0 ||
    imageBounds.width <= 0 ||
    imageBounds.height <= 0
  ) {
    return ADMIN_DESIGN_PREVIEW_MIN_CLICK_ZOOM_SCALE;
  }

  const naturalWidth = previewImageElement?.naturalWidth ?? 0;
  const naturalHeight = previewImageElement?.naturalHeight ?? 0;
  if (naturalWidth > 0 && naturalHeight > 0) {
    const imageRatio = naturalWidth / naturalHeight;
    const frameRatio = frameBounds.width / frameBounds.height;
    const containedBounds =
      imageRatio > frameRatio
        ? {
            width: frameBounds.width,
            height: frameBounds.width / imageRatio,
          }
        : {
            width: frameBounds.height * imageRatio,
            height: frameBounds.height,
          };

    return clampAdminPreviewZoomScale(
      Math.max(
        ADMIN_DESIGN_PREVIEW_MIN_CLICK_ZOOM_SCALE,
        frameBounds.width / containedBounds.width,
        frameBounds.height / containedBounds.height
      )
    );
  }

  return clampAdminPreviewZoomScale(
    Math.max(
      ADMIN_DESIGN_PREVIEW_MIN_CLICK_ZOOM_SCALE,
      frameBounds.width / imageBounds.width,
      frameBounds.height / imageBounds.height
    )
  );
}

const statusLabels: Record<SessionStatus, string> = {
  onboarding: "Onboarding",
  generating: "Generiert",
  designing: "Design bereit",
  configuring: "Konfiguration",
  checkout: "Checkout",
  ordered: "Bestellt",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const tone =
    status === "ordered"
      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
      : status === "generating"
        ? "bg-yellow-500/15 text-yellow-200 ring-yellow-500/30"
        : "bg-violet-500/15 text-violet-200 ring-violet-500/30";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ring-1 ${tone}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <pre className="mt-2 max-h-64 overflow-auto rounded-2xl bg-zinc-950/80 p-3 text-xs text-zinc-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function buildMediaItems(detail: AdminSessionDetail): MediaItem[] {
  const designUrls = collectDisplayDesignUrls(detail);
  const designs = designUrls.map((url, index) => ({
    url,
    label: `Design ${index + 1}`,
    description: `${detail.summary} · generiertes Design ${index + 1}`,
    kind: "design" as const,
  }));
  const references = detail.reference_images
    .filter((image) => typeof image.url === "string" && image.url.trim())
    .map((image, index) => ({
      url: image.url as string,
      label: `Referenz ${index + 1}`,
      description:
        image.description?.trim() ||
        image.storage_path ||
        `Verknüpfte Datei ${index + 1}`,
      kind: "reference" as const,
    }));
  return [...designs, ...references];
}

function MediaLightbox({
  items,
  index,
  detail,
  designPosition,
  onIndexChange,
  onPreviousDesign,
  onNextDesign,
  onClose,
}: {
  items: MediaItem[];
  index: number;
  detail: AdminSessionDetail;
  designPosition: { current: number; total: number };
  onIndexChange: (index: number) => void;
  onPreviousDesign: () => void;
  onNextDesign: () => void;
  onClose: () => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const previewDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<LightboxTab>("chat");
  const [previewZoomScale, setPreviewZoomScale] = useState(1);
  const [previewPanOffset, setPreviewPanOffset] = useState({ x: 0, y: 0 });
  const active = items[index];
  useEffect(() => {
    setPreviewZoomScale(1);
    setPreviewPanOffset({ x: 0, y: 0 });
    previewDragRef.current = null;
  }, [active?.url]);

  if (!active) return null;
  const designItems = items.filter((item) => item.kind === "design");
  const referenceItems = items.filter((item) => item.kind === "reference");
  const activeDesignIndex = Math.max(
    0,
    designItems.findIndex((item) => item.url === active.url)
  );
  const goToDesign = (designIndex: number) => {
    const target = designItems[designIndex];
    if (!target) return;
    onIndexChange(items.indexOf(target));
  };
  const previousVariant = () =>
    goToDesign((activeDesignIndex - 1 + designItems.length) % designItems.length);
  const nextVariant = () => goToDesign((activeDesignIndex + 1) % designItems.length);
  const isPreviewZoomed = previewZoomScale > 1;
  const togglePreviewZoom = (previewFrameElement: HTMLElement) => {
    const drag = previewDragRef.current;
    previewDragRef.current = null;
    if (drag?.moved) return;

    setPreviewZoomScale((current) => {
      if (current > 1) {
        setPreviewPanOffset({ x: 0, y: 0 });
        return 1;
      }
      return getAdminPreviewClickZoomScale(
        active,
        previewFrameElement,
        previewImageRef.current
      );
    });
  };
  const adjustPreviewZoomWithWheel = (
    deltaY: number,
    previewFrameElement: HTMLElement
  ) => {
    setPreviewZoomScale((current) => {
      const next = clampAdminPreviewZoomScale(
        current +
          (deltaY < 0
            ? ADMIN_PREVIEW_WHEEL_ZOOM_STEP
            : -ADMIN_PREVIEW_WHEEL_ZOOM_STEP)
      );
      if (next <= 1) {
        setPreviewPanOffset({ x: 0, y: 0 });
        return 1;
      }
      setPreviewPanOffset((currentOffset) =>
        clampAdminPreviewPanOffset(currentOffset, next, previewFrameElement)
      );
      return next;
    });
  };
  const startPreviewDrag = (clientX: number, clientY: number) => {
    if (!isPreviewZoomed) return;
    previewDragRef.current = {
      startX: clientX,
      startY: clientY,
      originX: previewPanOffset.x,
      originY: previewPanOffset.y,
      moved: false,
    };
  };
  const updatePreviewDrag = (
    clientX: number,
    clientY: number,
    boundsElement: HTMLElement
  ) => {
    const drag = previewDragRef.current;
    if (!drag) return;
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      drag.moved = true;
    }
    setPreviewPanOffset(
      clampAdminPreviewPanOffset(
        {
          x: drag.originX + dx,
          y: drag.originY + dy,
        },
        previewZoomScale,
        boundsElement
      )
    );
  };

  const dialog = (
    <div
      role="dialog"
      aria-label="Medienvorschau"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur lg:overflow-hidden"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onNextDesign();
        if (event.key === "ArrowLeft") onPreviousDesign();
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null || designItems.length <= 1) return;
        const delta = start - end;
        if (delta > 50) nextVariant();
        if (delta < -50) previousVariant();
      }}
    >
      <div
        data-testid="lightbox-shell"
        className="my-4 max-h-[calc(100vh-2rem)] w-full max-w-7xl overflow-y-auto rounded-[2rem] border border-zinc-700 bg-zinc-950 p-4 shadow-2xl lg:h-[calc(100vh-2rem)] lg:overflow-hidden"
      >
        <div
          role="toolbar"
          aria-label="Design-Navigation"
          className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 backdrop-blur"
        >
          <div
            role="group"
            aria-label="Design wechseln"
            className="flex rounded-full border border-violet-500/40 bg-violet-500/10 p-1 shadow-lg shadow-violet-950/30"
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onPreviousDesign}
              disabled={designPosition.total <= 1}
              className={secondaryActionClassName("border-violet-400/50 text-violet-100")}
            >
              Vorheriges Design
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onNextDesign}
              disabled={designPosition.total <= 1}
              className={secondaryActionClassName("border-violet-400/50 text-violet-100")}
            >
              Nächstes Design
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className={secondaryActionClassName()}
          >
            Schließen
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-violet-300">
              Generiertes Design {designPosition.current} von {designPosition.total}
            </p>
            <h3
              data-testid="admin-media-preview-summary"
              title={detail.summary}
              className="h-6 truncate text-lg font-semibold leading-6 text-white"
            >
              {detail.summary}
            </h3>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:h-[calc(100vh-11rem)] lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <button
              type="button"
              aria-label={`Medienvorschau ${isPreviewZoomed ? "verkleinern" : "vergrößern"}`}
              aria-pressed={isPreviewZoomed}
              onClick={(event) => togglePreviewZoom(event.currentTarget)}
              onWheel={(event) => {
                event.preventDefault();
                adjustPreviewZoomWithWheel(event.deltaY, event.currentTarget);
              }}
              onMouseDown={(event) => startPreviewDrag(event.clientX, event.clientY)}
              onMouseMove={(event) =>
                updatePreviewDrag(event.clientX, event.clientY, event.currentTarget)
              }
              onMouseLeave={() => {
                previewDragRef.current = null;
              }}
              data-testid="admin-media-preview-frame"
              className={`flex w-full items-center justify-center overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 outline-none ring-violet-400/50 transition focus-visible:ring-2 ${
                isPreviewZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={previewImageRef}
                src={active.url}
                alt="Medienvorschau"
                draggable={false}
                className="max-h-[48vh] w-full select-none object-contain transition-transform duration-300 ease-out"
                style={{
                  transform: `translate(${previewPanOffset.x}px, ${previewPanOffset.y}px) scale(${previewZoomScale})`,
                }}
              />
            </button>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Endergebnis
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Wechsle direkt zwischen den gespeicherten Designvarianten.
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-300">
                    {detail.summary}
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  {active.kind === "design"
                    ? `${activeDesignIndex + 1} von ${designItems.length} Bildvarianten`
                    : "Referenzbild"}
                </p>
              </div>

              {designItems.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Bildvarianten
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {designItems.map((item) => {
                      const itemIndex = items.indexOf(item);
                      const selected = itemIndex === index;
                      return (
                        <button
                          key={`${item.kind}-${item.url}`}
                          type="button"
                          onClick={() => onIndexChange(itemIndex)}
                          className={`flex items-center gap-3 rounded-2xl border p-2 text-left transition ${
                            selected
                              ? "border-violet-400 bg-violet-500/10 text-white"
                              : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600"
                          }`}
                          aria-label={`${item.label} anzeigen`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.url}
                            alt={item.description}
                            className="h-14 w-14 rounded-xl object-cover"
                          />
                          <span className="text-sm font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {referenceItems.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Referenzbilder
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {referenceItems.map((item) => {
                      const itemIndex = items.indexOf(item);
                      return (
                        <button
                          key={`${item.kind}-${item.url}`}
                          type="button"
                          onClick={() => onIndexChange(itemIndex)}
                          className="h-16 w-16 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
                          aria-label={`${item.label} Miniatur öffnen`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.url}
                            alt={item.description}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="flex min-h-[34rem] flex-col rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 lg:min-h-0">
            <div role="tablist" aria-label="Lightbox Informationen" className="grid grid-cols-4 gap-1 rounded-2xl bg-zinc-950/80 p-1">
              {lightboxTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-2 py-2 text-xs font-medium transition ${
                    activeTab === tab.id
                      ? "bg-violet-500 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex-1 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
              {activeTab === "chat" && (
                <div className="flex h-full flex-col">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Chatverlauf
                  </p>
                  <div
                    data-testid="lightbox-chat-scroll"
                    className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1"
                  >
                    {detail.conversation_history.length === 0 && (
                      <p className="text-sm text-zinc-500">Kein Chat gespeichert.</p>
                    )}
                    {detail.conversation_history.map((message, messageIndex) => (
                      <div
                        key={`${message.role}-${messageIndex}`}
                        className="rounded-2xl bg-zinc-900 px-3 py-2"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                          {message.role}
                        </p>
                        <p className="mt-1 text-sm leading-snug text-zinc-300">
                          {message.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "infos" && (
                <div className="space-y-3 text-sm text-zinc-300">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Design-Infos
                  </p>
                  <p>{active.description}</p>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 text-xs text-zinc-400">
                    <p>{detail.product ?? "Produkt offen"}</p>
                    <p>
                      {detail.product_color ?? "Farbe offen"}
                      {detail.quantity ? ` · ${detail.quantity} Stück` : ""}
                    </p>
                    <p>
                      {detail.event_type ?? "Anlass offen"}
                      {detail.style ? ` · ${detail.style}` : ""}
                    </p>
                  </div>
                  {referenceItems.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Verknüpfte Dateien
                      </p>
                      <div className="mt-2 space-y-1">
                        {referenceItems.map((item) => (
                          <p key={item.url} className="text-xs text-zinc-300">
                            {item.description}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "slogans" && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Slogans
                  </p>
                  {detail.slogans.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">Keine Slogans gespeichert.</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detail.slogans.map((slogan, sloganIndex) => (
                        <span
                          key={`${slogan.main_text}-${sloganIndex}`}
                          className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-200"
                        >
                          {slogan.main_text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "technik" && (
                <div className="space-y-3">
                  <JsonBlock label="Creative Brief" value={detail.creative_brief} />
                  <JsonBlock
                    label="Technische Daten"
                    value={{
                      onboarding_data: detail.onboarding_data,
                      product_selection: detail.product_selection,
                      prompt_data: detail.prompt_data,
                      config: detail.config,
                      design_assets: detail.design_assets,
                      selected_design_url: detail.selected_design_url,
                      selected_slogan: detail.selected_slogan,
                    }}
                  />
                </div>
              )}
            </div>

            {designItems.length > 1 && (
              <p className="text-xs text-zinc-500">
                Tipp: Links/rechts swipen wechselt nur die Bildvariante dieses Designs.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

function SessionCard({
  session,
  onDelete,
  onOpenPreview,
  deleting,
}: {
  session: AdminSessionSummary;
  onDelete: () => void;
  onOpenPreview: () => void;
  deleting: boolean;
}) {
  return (
    <article className="rounded-3xl border border-zinc-700/70 bg-zinc-950/50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="w-full sm:w-36">
          <div className="h-28 w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            {session.thumbnail_url ? (
              <button
                type="button"
                onClick={onOpenPreview}
                className="block h-full w-full"
                aria-label="Session Vorschau öffnen"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={session.thumbnail_url}
                  alt="Session Vorschau"
                  className="h-full w-full object-cover"
                />
              </button>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs text-zinc-500">
                Noch keine Vorschaubilder bereit
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`${session.summary} löschen`}
            className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-red-200 transition hover:border-red-400 hover:bg-red-500/20 disabled:opacity-50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v5" />
              <path d="M14 11v5" />
            </svg>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SessionStatusBadge status={session.status} />
            <span className="text-xs text-zinc-500">
              Aktualisiert {formatDate(session.updated_at)}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-zinc-100">
            {session.summary}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {session.product ?? "Produkt offen"}
            {session.product_color ? ` · ${session.product_color}` : ""}
            {session.quantity ? ` · ${session.quantity} Stück` : ""}
            {session.event_type ? ` · ${session.event_type}` : ""}
            {session.style ? ` · ${session.style}` : ""}
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            {session.design_count} Designs · {session.slogan_count} Slogans · Session{" "}
            {session.id}
          </p>
        </div>
      </div>
    </article>
  );
}

export function AdminSessionOverview() {
  const [sessions, setSessions] = useState<AdminSessionSummary[]>([]);
  const [details, setDetails] = useState<Record<string, AdminSessionDetail>>({});
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{
    sessionId: string;
    items: MediaItem[];
    index: number;
    detail: AdminSessionDetail;
  } | null>(null);
  const designSessionIds = sessions
    .filter((session) => session.has_designs || session.thumbnail_url)
    .map((session) => session.id);

  async function loadDetails(id: string): Promise<AdminSessionDetail | undefined> {
    if (details[id]) return details[id];
    if (loadingDetails.has(id)) return undefined;
    setLoadingDetails((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(
        `/api/admin/sessions?id=${encodeURIComponent(id)}&include=details`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as { session?: AdminSessionDetail };
      if (data.session) {
        setDetails((prev) => ({ ...prev, [id]: data.session! }));
        return data.session;
      }
    } finally {
      setLoadingDetails((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    return undefined;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/admin/sessions", { cache: "no-store" });
          const data = (await res.json()) as { sessions?: AdminSessionSummary[] };
          const nextSessions = data.sessions ?? [];
          setSessions(nextSessions);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function deleteSession(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/admin/sessions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setSessions((prev) => prev.filter((session) => session.id !== id));
      setDetails((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function openLightboxForSession(id: string) {
    const detail = await loadDetails(id);
    if (!detail) return;
    const items = buildMediaItems(detail);
    const selectedDesignIndex = detail.selected_design_url
      ? items.findIndex(
          (item) => item.kind === "design" && item.url === detail.selected_design_url
        )
      : -1;
    const initialDesignIndex =
      selectedDesignIndex >= 0
        ? selectedDesignIndex
        : items.findIndex((item) => item.kind === "design");
    if (initialDesignIndex >= 0) {
      setLightbox({ sessionId: id, items, index: initialDesignIndex, detail });
    }
  }

  async function switchLightboxDesign(direction: -1 | 1) {
    if (!lightbox || designSessionIds.length <= 1) return;
    const currentIndex = designSessionIds.indexOf(lightbox.sessionId);
    if (currentIndex < 0) return;
    const nextIndex =
      (currentIndex + direction + designSessionIds.length) % designSessionIds.length;
    await openLightboxForSession(designSessionIds[nextIndex]);
  }

  return (
    <AppSurface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Sessions</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Neueste Session aufgeklappt, ältere Einträge bleiben kompakt.
          </p>
        </div>
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
          {sessions.length} geladen
        </span>
      </div>

      {loading && <p className="mt-4 text-sm text-zinc-500">Lade Sessions...</p>}
      {!loading && sessions.length === 0 && (
        <AppNotice className="mt-4">Noch keine Sessions vorhanden.</AppNotice>
      )}

      <div
        data-testid="admin-session-grid"
        className="mt-4 grid gap-3 lg:grid-cols-2"
      >
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onDelete={() => void deleteSession(session.id)}
            onOpenPreview={() => void openLightboxForSession(session.id)}
            deleting={deletingIds.has(session.id)}
          />
        ))}
      </div>

      {lightbox && (
        <MediaLightbox
          items={lightbox.items}
          index={lightbox.index}
          detail={lightbox.detail}
          designPosition={{
            current: Math.max(1, designSessionIds.indexOf(lightbox.sessionId) + 1),
            total: designSessionIds.length,
          }}
          onIndexChange={(index) => setLightbox((prev) => (prev ? { ...prev, index } : prev))}
          onPreviousDesign={() => void switchLightboxDesign(-1)}
          onNextDesign={() => void switchLightboxDesign(1)}
          onClose={() => setLightbox(null)}
        />
      )}
    </AppSurface>
  );
}
