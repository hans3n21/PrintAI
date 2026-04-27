import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function PageShell({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-xl space-y-6 px-4 py-5 sm:py-7",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  eyebrow,
  description,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {eyebrow && (
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-300/80">
          {eyebrow}
        </p>
      )}
      <h1 className="text-2xl font-black tracking-tight text-white">{title}</h1>
      {description && <p className="text-sm leading-relaxed text-zinc-500">{description}</p>}
    </div>
  );
}

export function AppSurface({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-zinc-700/70 bg-zinc-800/80 p-5 shadow-2xl shadow-black/25 ring-1 ring-white/5 backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  );
}

export function AppNotice({
  children,
  tone = "neutral",
  className,
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "neutral" | "error" | "warning" | "success";
}) {
  const tones = {
    neutral: "border-zinc-700/70 bg-zinc-800/70 text-zinc-300",
    error: "border-red-500/40 bg-red-500/10 text-red-200",
    warning: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    success: "border-green-500/30 bg-green-500/10 text-green-300",
  };

  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

export function primaryActionClassName(className?: string) {
  return cn(
    "rounded-full bg-violet-600 shadow-lg shadow-violet-950/40 transition hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-violet-900/50 disabled:opacity-40 disabled:hover:translate-y-0",
    className
  );
}

export function secondaryActionClassName(className?: string) {
  return cn(
    "rounded-full border-zinc-700/80 bg-zinc-900/70 text-zinc-300 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white disabled:hover:translate-y-0",
    className
  );
}

export function FieldGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      {children}
    </div>
  );
}
