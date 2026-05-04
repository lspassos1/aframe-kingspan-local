const publicRoutePrefixes = ["/sign-in", "/sign-up"];
const publicRoutes = new Set(["/", "/privacy", "/terms", "/feedback"]);
const authenticatedAppShellRoutes = new Set(["/feedback"]);

export function isPublicRoute(pathname: string) {
  return publicRoutes.has(pathname) || publicRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function shouldUsePublicShell(pathname: string, isSignedIn: boolean) {
  if (isSignedIn && authenticatedAppShellRoutes.has(pathname)) {
    return false;
  }

  return isPublicRoute(pathname);
}
