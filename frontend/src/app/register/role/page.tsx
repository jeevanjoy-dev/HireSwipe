
"use client";

import { useRouter } from "next/navigation";

export default function RegisterRolePage() {
    const router = useRouter();

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-6 py-12 text-white">

            <div className="mx-auto flex min-h-[85vh] max-w-4xl flex-col items-center justify-center">

                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-bold tracking-tight">
                        Hire<span className="text-blue-400">Swipe</span>
                    </h1>

                    <h2 className="mt-8 text-3xl font-bold">
                        Join HireSwipe
                    </h2>

                    <p className="mt-3 text-slate-400">
                        What brings you to HireSwipe?
                    </p>
                </div>

                <div className="grid w-full gap-6 md:grid-cols-2">

                    {/* JOB SEEKER */}
                    <button
                        onClick={() => router.push("/register?role=candidate")}
                        className="group rounded-2xl border border-white/10 bg-white/10 p-8 text-left shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:border-blue-400 hover:bg-blue-500/10"
                    >
                        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/20 text-4xl">
                            💼
                        </div>

                        <h3 className="text-2xl font-bold">
                            I'm seeking a job
                        </h3>

                        <p className="mt-3 leading-7 text-slate-400">
                            Discover job opportunities, build your profile
                            and connect with employers.
                        </p>

                        <div className="mt-8 font-semibold text-blue-400 group-hover:text-blue-300">
                            Continue as Job Seeker →
                        </div>
                    </button>

                    {/* RECRUITER */}
                    <button
                        onClick={() => router.push("/register?role=recruiter")}
                        className="group rounded-2xl border border-white/10 bg-white/10 p-8 text-left shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:border-indigo-400 hover:bg-indigo-500/10"
                    >
                        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-4xl">
                            🏢
                        </div>

                        <h3 className="text-2xl font-bold">
                            I'm hiring
                        </h3>

                        <p className="mt-3 leading-7 text-slate-400">
                            Find talented candidates, publish job openings
                            and manage recruitment.
                        </p>

                        <div className="mt-8 font-semibold text-indigo-400 group-hover:text-indigo-300">
                            Continue as Employer →
                        </div>
                    </button>

                </div>

                <p className="mt-10 text-sm text-slate-400">
                    Already have an account?{" "}
                    <button
                        onClick={() => router.push("/login")}
                        className="font-semibold text-blue-400 hover:text-blue-300"
                    >
                        Sign in
                    </button>
                </p>

            </div>
        </main>
    );
}
