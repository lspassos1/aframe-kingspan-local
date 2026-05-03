import { currentUser } from "@clerk/nextjs/server";

export async function requireAdminUser() {
  const user = await currentUser();
  if (!user) return null;

  const allowedEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const primaryEmail = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress.toLowerCase();
  const isDevelopment = process.env.NODE_ENV !== "production";
  if (allowedEmails.length === 0 && isDevelopment) return user;
  if (primaryEmail && allowedEmails.includes(primaryEmail)) return user;
  return null;
}
