import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/edit(.*)",
  "/model-3d(.*)",
  "/technical-project(.*)",
  "/materials(.*)",
  "/structure(.*)",
  "/budget(.*)",
  "/quotation(.*)",
  "/scenarios(.*)",
  "/export(.*)",
  "/settings(.*)",
  "/help(.*)",
  "/start(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect({ unauthenticatedUrl: new URL("/", request.url).toString() });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|mp4|webm|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
