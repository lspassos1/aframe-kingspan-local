import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[#f5f3ed] px-5 py-10 text-neutral-950">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-6 block text-center text-sm font-semibold tracking-normal">
          Estudo Construtivo
        </Link>
        <div className="rounded-md border border-neutral-950/12 bg-white p-1.5 shadow-sm">
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            forceRedirectUrl="/start"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "shadow-none border-0",
                card: "shadow-none border-0",
                headerTitle: "text-neutral-950",
                headerSubtitle: "text-neutral-500",
                socialButtonsBlockButton: "rounded-full border-neutral-200 hover:bg-neutral-50 text-neutral-950",
                formButtonPrimary: "rounded-full bg-neutral-950 hover:bg-neutral-800 normal-case",
                footerActionLink: "text-neutral-950",
              },
            }}
          />
        </div>
      </div>
    </main>
  );
}
