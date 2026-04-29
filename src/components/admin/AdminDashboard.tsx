"use client";

import { NotesFeed } from "@/components/notes/NotesFeed";
import { Button } from "@/components/ui/button";
import { secondaryActionClassName } from "@/components/ui/appSurface";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { AdminSessionOverview } from "./AdminSessionOverview";

type AdminTab = "sessions" | "feedback";

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("sessions");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setActiveTab("sessions")}
            className={cn(
              secondaryActionClassName(),
              activeTab === "sessions" &&
                "border-violet-500/70 bg-violet-600/20 text-violet-100"
            )}
          >
            Sessions
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setActiveTab("feedback")}
            className={cn(
              secondaryActionClassName(),
              activeTab === "feedback" &&
                "border-violet-500/70 bg-violet-600/20 text-violet-100"
            )}
          >
            Feedback
          </Button>
        </div>
        <Link href="/" className={secondaryActionClassName()}>
          Zur Startseite
        </Link>
      </div>

      {activeTab === "sessions" ? <AdminSessionOverview /> : <NotesFeed />}
    </div>
  );
}
