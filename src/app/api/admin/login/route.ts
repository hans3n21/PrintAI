import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_VALUE,
  isValidAdminPassword,
} from "@/lib/adminAuth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };

  if (!isValidAdminPassword(body.password)) {
    return NextResponse.json({ error: "Passwort falsch" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, ADMIN_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
