import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-xl font-black tracking-tight text-white">
          Print<span className="text-violet-400">AI</span>
        </span>
      </Link>
    </header>
  );
}
