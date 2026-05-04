const publicRoutePrefixes = ["/sign-in", "/sign-up"];
const publicRoutes = new Set(["/", "/privacy", "/terms", "/feedback"]);
const authenticatedAppShellRoutes = new Set(["/feedback"]);
const authenticatedAppShellRoutesBeforeOnboarding = new Set(["/feedback"]);
const localProjectAppShellRoutes = new Set(["/feedback"]);
const appShellRoutesBeforeOnboarding = new Set(["/start", "/feedback"]);

export function normalizePathname(pathname: string) {
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
}

export function canUseAppShellBeforeOnboarding(pathname: string) {
  return appShellRoutesBeforeOnboarding.has(normalizePathname(pathname));
}

function matchesRoutePrefix(pathname: string, prefix: string) {
  const normalizedPrefix = normalizePathname(prefix);

  return pathname === normalizedPrefix || pathname.startsWith(`${normalizedPrefix}/`);
}

export function isPublicRoute(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);

  return (
    publicRoutes.has(normalizedPathname) ||
    publicRoutePrefixes.some((prefix) => matchesRoutePrefix(normalizedPathname, prefix))
  );
}

export function shouldUsePublicShell(pathname: string, isSignedIn: boolean, onboardingCompleted = false) {
  const normalizedPathname = normalizePathname(pathname);

  if (onboardingCompleted && localProjectAppShellRoutes.has(normalizedPathname)) {
    return false;
  }

  if (isSignedIn && authenticatedAppShellRoutesBeforeOnboarding.has(normalizedPathname)) {
    return false;
  }

  if (isSignedIn && onboardingCompleted && authenticatedAppShellRoutes.has(normalizedPathname)) {
    return false;
  }

  return isPublicRoute(normalizedPathname);
}
