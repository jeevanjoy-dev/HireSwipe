
"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleLogin,
  CredentialResponse,
} from "@react-oauth/google";

import { apiRequest } from "../../services/api";

type RegistrationStartResponse = {
  registration_token: string;
  message: string;
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const role = searchParams.get("role");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");

  const [registrationToken, setRegistrationToken] = useState("");

  const [step, setStep] = useState<"details" | "email">("details");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Redirect users according to their account role.
  function redirectByRole(userRole: string) {
    if (userRole === "candidate") {
      router.replace("/dashboard");
    } else if (userRole === "recruiter") {
      router.replace("/recruiter/dashboard");
    } else if (userRole === "admin") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/login");
    }
  }

  // Start email registration.
  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (role !== "candidate" && role !== "recruiter") {
      setMessage("Please select an account type.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setSuccessMessage("");

      const response =
        await apiRequest<RegistrationStartResponse>(
          "/auth/register/start",
          {
            method: "POST",
            body: JSON.stringify({
              name: name.trim(),
              email: email.trim(),
              role,
            }),
          }
        );

      setRegistrationToken(response.registration_token);
      setStep("email");

      setSuccessMessage(
        "Verification OTP sent to your email address."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not start registration."
      );
    } finally {
      setLoading(false);
    }
  }

  // Verify email OTP and create the account.
  async function handleEmailVerification(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");
      setSuccessMessage("");

      const response = await apiRequest<AuthResponse>(
        "/auth/register/verify-email",
        {
          method: "POST",
          body: JSON.stringify({
            registration_token: registrationToken,
            otp: emailOtp,
          }),
        }
      );

      localStorage.setItem(
        "access_token",
        response.access_token
      );

      setSuccessMessage(
        "Email verified! Your account has been created."
      );

      redirectByRole(response.user.role);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Email verification failed."
      );
    } finally {
      setLoading(false);
    }
  }

  // Resend email OTP.
  async function handleResendOtp() {
    try {
      setLoading(true);
      setMessage("");
      setSuccessMessage("");

      await apiRequest(
        "/auth/register/resend-otp",
        {
          method: "POST",
          body: JSON.stringify({
            registration_token: registrationToken,
          }),
        }
      );

      setSuccessMessage(
        "A new verification OTP has been sent."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not resend OTP."
      );
    } finally {
      setLoading(false);
    }
  }

  // Google Sign-In.
  async function handleGoogleSuccess(
    credentialResponse: CredentialResponse
  ) {
    if (!credentialResponse.credential) {
      setMessage(
        "Google authentication did not return an ID token."
      );
      return;
    }

    if (role !== "candidate" && role !== "recruiter") {
      setMessage("Please select an account type first.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setSuccessMessage("");

      const response = await apiRequest<AuthResponse>(
        "/auth/google",
        {
          method: "POST",
          body: JSON.stringify({
            id_token: credentialResponse.credential,
            role,
          }),
        }
      );

      localStorage.setItem(
        "access_token",
        response.access_token
      );

      setSuccessMessage(
        "Google authentication successful."
      );

      redirectByRole(response.user.role);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Google authentication failed."
      );
    } finally {
      setLoading(false);
    }
  }

  // Account role validation.
  if (role !== "candidate" && role !== "recruiter") {
    return (
      <div className="w-full max-w-md text-center">
        <h2 className="text-2xl font-bold">
          Select your account type
        </h2>

        <p className="mt-3 text-slate-400">
          Choose Job Seeker or Hiring before registering.
        </p>

        <button
          type="button"
          onClick={() => router.replace("/register/role")}
          className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
        >
          Choose Account Type
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      {/* Page heading */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold">
          Hire<span className="text-blue-400">Swipe</span>
        </h1>

        <h2 className="mt-7 text-2xl font-bold">
          {step === "details"
            ? "Create your account"
            : "Verify your email"}
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          {step === "details"
            ? role === "candidate"
              ? "Create your Job Seeker account."
              : "Create your Employer account."
            : `Enter the OTP sent to ${email}.`}
        </p>
      </div>

      {/* Registration card */}
      <div className="rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">

        {/* Error message */}
        {message && (
          <div className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">
            {message}
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div className="mb-5 rounded-xl border border-green-400/20 bg-green-500/10 p-3 text-sm text-green-300">
            {successMessage}
          </div>
        )}

        {/* STEP 1: Registration details */}
        {step === "details" && (
          <>
            <form
              onSubmit={handleRegister}
              className="space-y-5"
            >
              {/* Full name */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Full Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none focus:border-blue-400"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none focus:border-blue-400"
                />
              </div>

              {/* Continue with email */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold shadow-lg transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60"
              >
                {loading
                  ? "Sending OTP..."
                  : "Continue with Email"}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />

              <span className="text-xs text-slate-400">
                OR
              </span>

              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Google Sign-In */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() =>
                  setMessage("Google sign-in failed.")
                }
                theme="filled_black"
                shape="rectangular"
                size="large"
                text="continue_with"
                width="300"
              />
            </div>
          </>
        )}

        {/* STEP 2: Email OTP verification */}
        {step === "email" && (
          <form
            onSubmit={handleEmailVerification}
            className="space-y-5"
          >
            <p className="text-sm text-slate-300">
              Verification email sent to:

              <strong className="mt-1 block">
                {email}
              </strong>
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              value={emailOtp}
              onChange={(e) =>
                setEmailOtp(
                  e.target.value.replace(/\D/g, "")
                )
              }
              placeholder="Enter 6-digit email OTP"
              required
              className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-center tracking-[0.5em] outline-none focus:border-blue-400"
            />

            <button
              type="submit"
              disabled={loading || emailOtp.length !== 6}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={loading}
              className="w-full text-sm text-blue-300 hover:text-blue-200 disabled:opacity-60"
            >
              Resend OTP
            </button>
          </form>
        )}

        {/* Sign-in link */}
        <div className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="font-semibold text-blue-400 hover:text-blue-300"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-10 text-white">
      <Suspense
        fallback={
          <div className="text-white">
            Loading registration...
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </div>
  );
}
