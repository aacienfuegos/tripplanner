"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/oauth/callback-url";

// The hidden callbackUrl field is the client's to change, so each action checks
// it again: only the authorization endpoint, otherwise the dashboard.
const redirectTo = (formData: FormData) => safeCallbackUrl(formData.get("callbackUrl"));

export async function googleSignIn(formData: FormData) {
  await signIn("google", { redirectTo: redirectTo(formData) });
}

export async function githubSignIn(formData: FormData) {
  await signIn("github", { redirectTo: redirectTo(formData) });
}

export async function resendSignIn(formData: FormData) {
  await signIn("resend", {
    email: formData.get("email") as string,
    redirectTo: redirectTo(formData),
  });
}

export async function devSignIn(formData: FormData) {
  try {
    await signIn("dev-credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo: redirectTo(formData),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/auth/error?error=CredentialsSignin");
    }
    throw error; // re-lanza NEXT_REDIRECT
  }
}
