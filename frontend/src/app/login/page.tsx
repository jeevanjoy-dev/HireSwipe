
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleLogin,
  CredentialResponse,
} from "@react-oauth/google";

import { apiRequest } from "../../services/api";

type LoginStartResponse = {
  challenge_token: string;
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

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeToken, setChallengeToken] = useState("");

  const [step, setStep] = useState<"email" | "otp">("email");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function redirectByRole(role: string) {
    if (role === "candidate") {
      router.replace("/dashboard");
    } else if (role === "recruiter") {
      router.replace("/recruiter/dashboard");
    } else if (role === "admin") {
      router.replace("/admin/dashboard");
    } else {
      localStorage.removeItem("access_token");
      setMessage("Your account has an unsupported role.");
    }
  }

  // Step 1: Request login OTP.
  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");
      setSuccessMessage("");

      const response = await apiRequest<LoginStartResponse>(
        "/auth/login/start",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      setChallengeToken(response.challenge_token);
      setStep("otp");

      setSuccessMessage(
        "If an account is registered with this email, a login OTP has been sent."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not request login OTP."
      );
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP and log in.
  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");
      setSuccessMessage("");

      const response = await apiRequest<AuthResponse>(
        "/auth/login/verify",
        {
          method: "POST",
          body: JSON.stringify({
            challenge_token: challengeToken,
            otp,
          }),
        }
      );

      localStorage.setItem(
        "access_token",
        response.access_token
      );

      setSuccessMessage("Login successful!");

      redirectByRole(response.user.role);
    } catch (error) {
      localStorage.removeItem("access_token");

      setMessage(
        error instanceof Error
          ? error.message
          : "OTP verification failed."
      );
    } finally {
      setLoading(false);
    }
  }

  // Request another OTP using the login start endpoint.
  async function handleResendOtp() {
    try {
      setLoading(true);
      setMessage("");
      setSuccessMessage("");

      const response = await apiRequest<LoginStartResponse>(
        "/auth/login/start",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      setChallengeToken(response.challenge_token);
      setOtp("");

      setSuccessMessage(
        "If an account is registered with this email, a new OTP has been sent."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not resend login OTP."
      );
    } finally {
      setLoading(false);
    }
  }

  // Google Sign-In for existing accounts.
  async function handleGoogleSuccess(
    credentialResponse: CredentialResponse
  ) {
    if (!credentialResponse.credential) {
      setMessage(
        "Google authentication did not return an ID token."
      );
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
          }),
        }
      );

      localStorage.setItem(
        "access_token",
        response.access_token
      );

      setSuccessMessage("Google login successful!");

      redirectByRole(response.user.role);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Google login failed. If you are new to HireSwipe, create an account first."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[85vh] max-w-md items-center justify-center">
        <div className="w-full">

          {/* BRAND */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight">
              Hire<span className="text-blue-400">Swipe</span>
            </h1>

            <p className="mt-3 text-slate-400">
              Find the right opportunity. Build your future.
            </p>
          </div>

          {/* LOGIN CARD */}
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">

            <div className="mb-7">
              <h2 className="text-2xl font-bold">
                {step === "email" ? "Welcome Back" : "Verify Your Email"}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {step === "email"
                  ? "Sign in securely using your email address or Google."
                  : `Enter the six-digit OTP sent to ${email}.`}
              </p>
            </div>

            {/* ERROR MESSAGE */}
            {message && (
              <div className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {message}
              </div>
            )}

            {/* SUCCESS MESSAGE */}
            {successMessage && (
              <div className="mb-5 rounded-xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                {successMessage}
              </div>
            )}

            {/* STEP 1: EMAIL */}
            {step === "email" && (
              <>
                <form
                  onSubmit={handleSendOtp}
                  className="space-y-5"
                >
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium text-slate-200"
                    >
                      Email Address
                    </label>

                    <input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      required
                      autoComplete="email"
                      className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Sending OTP..." : "Continue with Email"}
                  </button>
                </form>

                {/* DIVIDER */}
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs text-slate-400">OR</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                {/* GOOGLE LOGIN */}
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

            {/* STEP 2: OTP */}
            {step === "otp" && (
              <form
                onSubmit={handleVerifyOtp}
                className="space-y-5"
              >
                <div>
                  <p className="mb-4 text-sm text-slate-300">
                    Login verification code sent to:
                    <strong className="mt-1 block">
                      {email}
                    </strong>
                  </p>

                  <label
                    htmlFor="otp"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Enter OTP
                  </label>

                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(event) =>
                      setOtp(
                        event.target.value.replace(/\D/g, "")
                      )
                    }
                    required
                    autoComplete="one-time-code"
                    className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-center tracking-[0.5em] text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="w-full text-sm text-blue-300 transition hover:text-blue-200 disabled:opacity-60"
                >
                  Resend OTP
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setChallengeToken("");
                    setMessage("");
                    setSuccessMessage("");
                  }}
                  disabled={loading}
                  className="w-full text-sm text-slate-400 transition hover:text-white"
                >
                  Change email address
                </button>
              </form>
            )}

            {/* CREATE ACCOUNT */}
            <div className="mt-6 border-t border-white/10 pt-6 text-center">
              <p className="mb-3 text-sm text-slate-400">
                Don't have a HireSwipe account?
              </p>

              <button
                type="button"
                onClick={() => router.push("/register/role")}
                className="w-full rounded-xl border border-blue-400/40 bg-blue-500/10 px-5 py-3 font-semibold text-blue-300 transition hover:border-blue-400 hover:bg-blue-500/20 hover:text-white"
              >
                Create an Account
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            HireSwipe • Connecting talent with opportunity
          </p>
        </div>
      </div>
    </main>
  );
}
