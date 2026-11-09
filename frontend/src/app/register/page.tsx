
"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { apiRequest } from "../../services/api";

type RegistrationResponse = {
    registration_token: string;
    message: string;
};

type VerificationResponse = {
    email_verified: boolean;
    phone_verified: boolean;
    message: string;
};

function RegisterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const role = searchParams.get("role");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [emailOtp, setEmailOtp] = useState("");
    const [phoneOtp, setPhoneOtp] = useState("");

    const [registrationToken, setRegistrationToken] = useState("");

    const [step, setStep] = useState<
        "details" | "email" | "phone" | "complete"
    >("details");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    async function handleRegister(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (role !== "candidate" && role !== "recruiter") {
            setMessage("Please select an account type.");
            return;
        }

        if (password !== confirmPassword) {
            setMessage("Passwords do not match.");
            return;
        }

        if (!/^\+?[0-9\s()-]{7,20}$/.test(phone)) {
            setMessage("Please enter a valid phone number.");
            return;
        }

        try {
            setLoading(true);
            setMessage("");
            setSuccessMessage("");

            const response = await apiRequest(
                "/auth/register/start",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name,
                        email,
                        phone,
                        password,
                        role,
                    }),
                }
            ) as RegistrationResponse;

            setRegistrationToken(response.registration_token);
            setStep("email");

            setSuccessMessage(
                "Registration started! Check your email for the verification OTP."
            );

        } catch (error) {
            console.error("Registration error:", error);

            setMessage(
                error instanceof Error
                    ? error.message
                    : "Could not start registration."
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleEmailVerification(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        try {
            setLoading(true);
            setMessage("");
            setSuccessMessage("");

            const response = await apiRequest(
                "/auth/register/verify-email",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        registration_token: registrationToken,
                        otp: emailOtp,
                    }),
                }
            ) as VerificationResponse;

            if (response.email_verified) {
                setStep("phone");
                setSuccessMessage(
                    "Email verified successfully! Now verify your phone number."
                );
            }

        } catch (error) {
            console.error("Email verification error:", error);

            setMessage(
                error instanceof Error
                    ? error.message
                    : "Email verification failed."
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleSendPhoneOtp() {
        try {
            setLoading(true);
            setMessage("");
            setSuccessMessage("");

            const response = await apiRequest(
                "/auth/register/send-phone-otp",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        registration_token: registrationToken,
                    }),
                }
            );

            setSuccessMessage(
                "Demo OTP is ready. Enter 123456 to verify your phone."
            );

        } catch (error) {
            console.error("Phone OTP request error:", error);

            setMessage(
                error instanceof Error
                    ? error.message
                    : "Could not prepare phone verification."
            );
        } finally {
            setLoading(false);
        }
    }

    async function handlePhoneVerification(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        try {
            setLoading(true);
            setMessage("");
            setSuccessMessage("");

            const response = await apiRequest(
                "/auth/register/verify-phone",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        registration_token: registrationToken,
                        otp: phoneOtp,
                    }),
                }
            ) as VerificationResponse;

            if (response.phone_verified) {
                setStep("complete");
                setSuccessMessage(
                    "Phone number verified successfully!"
                );
            }

        } catch (error) {
            console.error("Phone verification error:", error);

            setMessage(
                error instanceof Error
                    ? error.message
                    : "Phone verification failed."
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleCompleteRegistration() {
        try {
            setLoading(true);
            setMessage("");

            await apiRequest(
                "/auth/register/complete",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        registration_token: registrationToken,
                    }),
                }
            );

            setSuccessMessage(
                "Your HireSwipe account has been created successfully!"
            );

            router.replace("/login");

        } catch (error) {
            console.error("Registration completion error:", error);

            setMessage(
                error instanceof Error
                    ? error.message
                    : "Could not complete registration."
            );
        } finally {
            setLoading(false);
        }
    }

    if (role !== "candidate" && role !== "recruiter") {
        return (
            <div className="text-center">
                <h2 className="text-2xl font-bold">
                    Select your account type
                </h2>

                <p className="mt-3 text-slate-400">
                    Please choose Job Seeker or Hiring before registering.
                </p>

                <button
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

            <div className="mb-8 text-center">
                <h1 className="text-4xl font-bold">
                    Hire<span className="text-blue-400">Swipe</span>
                </h1>

                <h2 className="mt-7 text-2xl font-bold">
                    {step === "details" && "Create your account"}
                    {step === "email" && "Verify your email"}
                    {step === "phone" && "Verify your phone"}
                    {step === "complete" && "Registration complete"}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                    {step === "details" &&
                        (role === "candidate"
                            ? "Create your Job Seeker account."
                            : "Create your Employer account.")}

                    {step === "email" &&
                        "Enter the OTP sent to your email address."}

                    {step === "phone" &&
                        "Complete your phone number verification."}

                    {step === "complete" &&
                        "Both verification steps are successful."}
                </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">

                {step === "details" && (
                    <form onSubmit={handleRegister} className="space-y-5">

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
                                maxLength={100}
                                autoComplete="name"
                                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none focus:border-blue-400"
                            />
                        </div>

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

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Phone Number
                            </label>

                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Enter your phone number"
                                required
                                maxLength={20}
                                autoComplete="tel"
                                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none focus:border-blue-400"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Password
                            </label>

                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Create a password"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 pr-12 outline-none focus:border-blue-400"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    {showPassword ? "🙈" : "👁"}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Confirm Password
                            </label>

                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    required
                                    autoComplete="new-password"
                                    className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 pr-12 outline-none focus:border-blue-400"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    {showConfirmPassword ? "🙈" : "👁"}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold shadow-lg transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60"
                        >
                            {loading ? "Sending OTP..." : "Continue"}
                        </button>
                    </form>
                )}

                {step === "email" && (
                    <form onSubmit={handleEmailVerification} className="space-y-5">

                        <p className="text-sm text-slate-300">
                            Verification email sent to:
                            <strong className="block mt-1">{email}</strong>
                        </p>

                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            pattern="[0-9]{6}"
                            value={emailOtp}
                            onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
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
                    </form>
                )}

                {step === "phone" && (
                    <div className="space-y-5">

                        <p className="text-sm text-slate-300">
                            Phone number:
                            <strong className="block mt-1">{phone}</strong>
                        </p>

                        <button
                            type="button"
                            onClick={handleSendPhoneOtp}
                            disabled={loading}
                            className="w-full rounded-xl border border-blue-400 px-5 py-3 font-semibold text-blue-300 hover:bg-blue-500/10 disabled:opacity-60"
                        >
                            {loading ? "Preparing OTP..." : "Send Demo OTP"}
                        </button>

                        <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-sm text-blue-200">
                            Development mode: No SMS is sent.
                            Your test OTP is <strong>123456</strong>.
                        </div>

                        <form onSubmit={handlePhoneVerification} className="space-y-4">

                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                pattern="[0-9]{6}"
                                value={phoneOtp}
                                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ""))}
                                placeholder="Enter phone OTP"
                                required
                                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-center tracking-[0.5em] outline-none focus:border-blue-400"
                            />

                            <button
                                type="submit"
                                disabled={loading || phoneOtp.length !== 6}
                                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold disabled:opacity-60"
                            >
                                {loading ? "Verifying..." : "Verify Phone"}
                            </button>
                        </form>
                    </div>
                )}

                {step === "complete" && (
                    <div className="space-y-5 text-center">

                        <div className="text-5xl">✓</div>

                        <p className="text-slate-300">
                            Your email and phone number have been verified.
                        </p>

                        <button
                            type="button"
                            onClick={handleCompleteRegistration}
                            disabled={loading}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold disabled:opacity-60"
                        >
                            {loading ? "Creating Account..." : "Create My Account"}
                        </button>
                    </div>
                )}

                {message && (
                    <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {message}
                    </div>
                )}

                {successMessage && (
                    <div className="mt-5 rounded-xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                        {successMessage}
                    </div>
                )}

                {step === "details" && (
                    <button
                        onClick={() => router.push("/register/role")}
                        className="mt-5 w-full text-sm text-slate-400 hover:text-white"
                    >
                        ← Change account type
                    </button>
                )}
            </div>

            <p className="mt-6 text-center text-sm text-slate-400">
                Already registered?{" "}
                <button
                    onClick={() => router.push("/login")}
                    className="font-semibold text-blue-400 hover:text-blue-300"
                >
                    Sign in
                </button>
            </p>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-6 py-12 text-white">
            <div className="flex min-h-[85vh] items-center justify-center">
                <Suspense fallback={<p>Loading registration...</p>}>
                    <RegisterForm />
                </Suspense>
            </div>
        </main>
    );
}
