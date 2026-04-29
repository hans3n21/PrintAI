import { ImageLightbox, type LightboxItem } from "@/components/gallery/ImageLightbox";
import type { ChatAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
}

function hideReferenceMetadata(content: string, hasAttachments: boolean) {
  if (!hasAttachments) return content;
  return content
    .replace(
      /\n?\(\s*Referenzbild \d+:\s*https?:\/\/[^\n)]+(?:\n\s*Referenzbild \d+:\s*https?:\/\/[^\n)]+)*\s*\)\s*$/i,
      ""
    )
    .trim();
}

function StaticVoiceWaveform() {
  return (
    <div className="flex h-6 items-center gap-1">
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="w-0.5 rounded-full bg-white/80"
          style={{ height: `${7 + ((i * 5) % 17)}px` }}
        />
      ))}
    </div>
  );
}

export function ChatBubble({ role, content, attachments = [] }: ChatBubbleProps) {
  const isAssistant = role === "assistant";
  const isVoiceMessage = !isAssistant && content.startsWith("[voice]");
  const rawVisibleContent = isVoiceMessage ? content.replace(/^\[voice\]/, "") : content;
  const visibleContent = hideReferenceMetadata(rawVisibleContent, attachments.length > 0);
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState<number | null>(null);
  const lightboxItems: LightboxItem[] = attachments.map((attachment) => ({
    url: attachment.url,
    label: attachment.label,
    kind: attachment.kind,
  }));

  return (
    <div className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "min-w-0 max-w-[80%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isAssistant
            ? "rounded-tl-sm bg-zinc-800 text-zinc-100"
            : "rounded-tr-sm bg-violet-600 text-white"
        )}
      >
        {isVoiceMessage ? (
          <div className="flex items-center gap-3">
            <StaticVoiceWaveform />
            <span>{visibleContent}</span>
          </div>
        ) : (
          visibleContent
        )}
        {attachments.length > 0 && (
          <div className="mt-3 border-t border-white/20 pt-3">
            <p className="mb-2 text-xs font-medium text-white/80">
              {attachments.length === 1
                ? "1 Referenzbild"
                : `${attachments.length} Referenzbilder`}
            </p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <button
                  key={`${attachment.url}-${index}`}
                  type="button"
                  onClick={() => setActiveAttachmentIndex(index)}
                  aria-label={`${attachment.label} öffnen`}
                  className="h-16 w-16 overflow-hidden rounded-xl border border-white/25 bg-black/20 transition hover:-translate-y-0.5 hover:border-white/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.url}
                    alt={attachment.label}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {activeAttachmentIndex !== null && (
        <ImageLightbox
          items={lightboxItems}
          activeIndex={activeAttachmentIndex}
          onSelect={setActiveAttachmentIndex}
          onClose={() => setActiveAttachmentIndex(null)}
        />
      )}
    </div>
  );
}
