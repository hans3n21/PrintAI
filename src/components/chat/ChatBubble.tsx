import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
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

export function ChatBubble({ role, content }: ChatBubbleProps) {
  const isAssistant = role === "assistant";
  const isVoiceMessage = !isAssistant && content.startsWith("[voice]");
  const visibleContent = isVoiceMessage ? content.replace(/^\[voice\]/, "") : content;

  return (
    <div className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
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
      </div>
    </div>
  );
}
