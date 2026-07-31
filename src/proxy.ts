import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("session_token")?.value || request.cookies.get("better-auth.session_token")?.value
  const secureSessionCookie = request.cookies.get("__Secure-session_token")?.value || request.cookies.get("__Secure-better-auth.session_token")?.value
  const sessionId = sessionCookie || secureSessionCookie
  
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard")
  const isAuthRoute = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup"

  if (isDashboardRoute && !sessionId) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (isAuthRoute && sessionId) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/login", "/signup"],
}
