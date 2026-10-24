"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validators";
import { z } from "zod";
import { useToast } from "@/components/ui/Toast";
import { Loader2, ArrowRight, ShieldCheck, Zap } from "lucide-react";

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    try {
      setLoading(true);
      setErrorMessage("");

      const res = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (res?.error) {
        setErrorMessage(res.error);
        showToast(res.error, "error");
      } else {
        showToast("Welcome back!", "success");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage("Something went wrong during sign in");
      showToast("Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setValue("email", "demo@splitease.app");
    setValue("password", "Demo@1234");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/50">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 font-black text-xl mb-3 shadow-md">
              ₹
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Welcome back
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enter your credentials to access your shared balances
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                {...register("email")}
                placeholder="name@domain.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm transition"
              />
              {errors.email && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Password
                </label>
              </div>
              <input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm transition"
              />
              {errors.password && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 shadow-lg shadow-slate-900/10 dark:shadow-emerald-500/10 transition disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill button */}
          <div className="mt-5 pt-5 border-t border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={fillDemo}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Use Demo Account (demo@splitease.app)
            </button>
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-bold text-slate-900 dark:text-emerald-400 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
