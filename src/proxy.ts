import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";
  const isAuthed = isAdminCookieValid(request.cookies.get(ADMIN_COOKIE_NAME)?.value);

  if (!isAuthed && !isLoginPage) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (isAuthed && isLoginPage) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
