import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName, verifyAppSession } from "@/lib/auth/session";
import { canAccessPath, homeForRole } from "@/lib/permissions";

const dashboardPrefixes = ["/student", "/teacher", "/admin"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  if (!dashboardPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return response;
  }

  const session = await verifyAppSession(
    request.cookies.get(sessionCookieName)?.value,
  );

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(session.role, pathname)) {
    return NextResponse.redirect(
      new URL(homeForRole(session.role), request.url),
    );
  }

  response.headers.set("X-EduPulse-Org", session.orgId);
  response.headers.set("X-EduPulse-Role", session.role);

  return response;
}

export const config = {
  matcher: [
    "/student/:path*",
    "/teacher/:path*",
    "/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
