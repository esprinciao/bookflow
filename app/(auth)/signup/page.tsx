import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account — BookFlow" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Set up your booking page
      </h1>
      <p className="mt-2 mb-8 text-sm text-muted">
        Takes a minute. You can add services and hours straight after.
      </p>
      <SignupForm />
    </>
  );
}
