import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { NotesFeed } from "@/components/notes/NotesFeed";
import { PageTitle } from "@/components/ui/appSurface";

export default function AdminPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-zinc-700/70 bg-zinc-800/80 p-5 shadow-2xl shadow-black/25 ring-1 ring-white/5 backdrop-blur">
        <PageTitle
          eyebrow="Admin"
          title="PrintAI Backend"
          description="Feedback prüfen, erledigen und im Archiv nachvollziehen."
        />
        <AdminLogoutButton />
      </header>

      <NotesFeed />
    </main>
  );
}
