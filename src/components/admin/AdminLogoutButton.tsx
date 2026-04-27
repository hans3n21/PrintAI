"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void logout()}
      disabled={loading}
      className="border-zinc-700 text-zinc-300"
    >
      {loading ? "..." : "Logout"}
    </Button>
  );
}
