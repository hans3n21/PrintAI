import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/70 bg-zinc-950/80 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between">
        <Link href="/" className="group flex items-center gap-2">
          <span className="rounded-full border border-zinc-700/70 bg-zinc-900/70 px-3 py-1.5 text-xl font-black tracking-tight text-white shadow-sm shadow-black/20 transition group-hover:border-violet-500/70">
            Print<span className="text-violet-400">AI</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
