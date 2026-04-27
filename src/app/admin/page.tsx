import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { NotesFeed } from "@/components/notes/NotesFeed";

export default function AdminPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">PrintAI Backend</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Feedback prüfen, erledigen und im Archiv nachvollziehen.
          </p>
        </div>
        <AdminLogoutButton />
      </header>

      <NotesFeed />
    </main>
  );
}
