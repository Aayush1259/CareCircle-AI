import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Chrome, HeartHandshake, LockKeyhole, Mail, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { demoAccounts, demoPassword } from "@carecircle/shared";
import { Button, Card, Field, Input } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { resolveViewerRole, roleHomePath } from "@/lib/roles";
import { hasBrowserSupabaseAuth } from "@/lib/supabaseBrowser";

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loading, startGoogleAuth, appConfig } = useAppData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const inviteToken = searchParams.get("inviteToken");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const session = await login(email, password);
      toast.success("Welcome back to CareCircle.");
      if (inviteToken) {
        navigate(`/invite/${inviteToken}`, { replace: true });
        return;
      }
      navigate(roleHomePath(resolveViewerRole(session.viewer.role, session.access?.accessRole)), { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await startGoogleAuth({ mode: "login", inviteToken: inviteToken ?? undefined });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in is not ready right now.");
    }
  };

  return (
    <div className="relative flex min-h-screen min-h-[100svh] w-full bg-bg">
      <div className="relative hidden w-[52%] overflow-hidden lg:block">
        <motion.img
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          src="https://images.unsplash.com/photo-1576091160550-217359f4ecf8?q=80&w=2070&auto=format&fit=crop"
          alt="Healthcare background"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.28),rgba(67,56,202,0.55),rgba(15,23,42,0.78))]" />
        <div className="absolute left-8 top-8 rounded-full border border-white/15 bg-white/10 px-5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-white/80 backdrop-blur-md">
          Connected Care Workspace
        </div>

        <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="max-w-2xl"
          >
            <p className="font-['Outfit'] text-sm font-bold uppercase tracking-[0.28em] text-white/68">CareCircle AI</p>
            <h1 className="hero-display mt-6">
              Professional care coordination that still feels human.
            </h1>
            <p className="hero-body-copy mt-6 max-w-xl text-white/80 sm:text-lg xl:text-xl">
              Bring family updates, medication routines, appointments, and emergency planning into one calm system that works across caregivers and clinicians.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="mt-10 grid gap-4 xl:grid-cols-3"
          >
            {[
              {
                title: "Calm Daily Rhythm",
                body: "See what matters now, from medication timing to the next visit on deck.",
              },
              {
                title: "Shared Family Clarity",
                body: "Everyone stays aligned without extra calls, texts, and scattered notes.",
              },
              {
                title: "Clinical Context",
                body: "Keep documents, vitals, and care notes together in a review-ready format.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.8rem] border border-white/12 bg-white/10 p-5 backdrop-blur-md">
                <p className="font-['Outfit'] text-base font-bold xl:text-lg">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/72">{item.body}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-3 py-4 sm:px-6 sm:py-6 lg:w-[48%] lg:p-10">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-[35rem] space-y-4 sm:space-y-5"
        >
          <div className="rounded-[1.8rem] border border-white/80 bg-white/82 p-4 shadow-premium backdrop-blur-2xl sm:rounded-[2rem] sm:p-5 lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-['Outfit'] text-[0.72rem] font-bold uppercase tracking-[0.22em] text-brand/80">CareCircle AI</p>
                <h1 className="mt-2 font-['Outfit'] text-[1.65rem] font-bold tracking-tight text-textPrimary sm:text-2xl">Care, organized beautifully.</h1>
              </div>
              <div className="rounded-2xl bg-brandSoft p-3 text-brandDark shadow-sm">
                <HeartHandshake className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {["Shared family visibility", "Clear next steps", "Secure sign-in"].map((item) => (
                <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-textSecondary sm:text-xs sm:normal-case sm:tracking-normal">
                  {item}
                </div>
              ))}
            </div>
          </div>

          {inviteToken ? (
            <div className="rounded-[1.6rem] border border-brand/15 bg-brandSoft/60 px-5 py-4 text-sm font-medium text-brandDark">
              You&apos;re joining through an invitation. Sign in to finish access setup for this care circle.
            </div>
          ) : null}

          <Card className="mesh-card p-5 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-['Outfit'] text-[0.74rem] font-bold uppercase tracking-[0.24em] text-brand/75">Welcome back</p>
                <h2 className="responsive-title-xl mt-3 text-textPrimary">Sign in to your care workspace</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-textSecondary sm:text-base sm:leading-7">
                  Access your dashboard, review the day&apos;s plan, and keep every caregiver aligned in one place.
                </p>
              </div>
              <div className="hidden rounded-[1.5rem] bg-brandSoft p-4 text-brandDark shadow-sm sm:flex">
                <HeartHandshake className="h-7 w-7" />
              </div>
            </div>

            <form className="grid gap-5" onSubmit={handleSubmit}>
              <Field label="Email address">
                <div className="relative group">
                  <Mail className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-textSecondary transition-colors group-focus-within:text-brand" />
                  <Input
                    required
                    type="email"
                    className="pl-14"
                    value={email}
                    placeholder="demo@carecircle.ai"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </Field>

              <Field label="Password">
                <div className="relative group">
                  <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-textSecondary transition-colors group-focus-within:text-brand" />
                  <Input
                    required
                    type="password"
                    className="pl-14"
                    value={password}
                    placeholder="••••••••"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </Field>

              <div className="grid gap-3 pt-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <Button type="submit" className="group w-full overflow-hidden">
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? "Authenticating..." : "Sign in to dashboard"}
                    {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                  </span>
                </Button>
                <Link to="/forgot-password" title="Recover account access" className="inline-flex items-center justify-center rounded-[1.15rem] px-3 py-2 text-center text-sm font-semibold text-textSecondary transition-colors hover:text-textPrimary sm:justify-self-end">
                  Forgot password?
                </Link>
              </div>
            </form>

            {hasBrowserSupabaseAuth && appConfig.googleAuthEnabled ? (
              <>
                <div className="my-8 flex items-center gap-4 text-sm text-textSecondary/50">
                  <div className="h-px flex-1 bg-borderColor/60" />
                  <span className="font-bold uppercase tracking-widest text-[10px]">Alternative sign-in</span>
                  <div className="h-px flex-1 bg-borderColor/60" />
                </div>
                <Button variant="ghost" className="w-full" disabled={loading} onClick={() => void handleGoogleSignIn()}>
                  <Chrome className="h-5 w-5" />
                  Continue with Google
                </Button>
              </>
            ) : null}

            <div className="mt-8 rounded-[1.8rem] border border-slate-200/80 bg-white/78 p-5 shadow-[0_14px_30px_-20px_rgba(15,23,42,0.18)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-['Outfit'] text-sm font-bold uppercase tracking-[0.18em] text-textPrimary">Demo Access</p>
                  <p className="mt-1 text-[0.85rem] text-textSecondary sm:text-sm">Instantly preview the interface with curated roles.</p>
                </div>
                <div className="rounded-full bg-brand/10 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-brand">
                  Quick-fill
                </div>
              </div>
              <div className="mt-4 grid gap-2.5">
                {demoAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    className="group flex items-center justify-between gap-4 rounded-[1.2rem] border border-slate-200/85 bg-white px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-premium sm:rounded-[1.35rem] sm:py-4"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(demoPassword);
                    }}
                  >
                    <div className="min-w-0">
                      <span className="block text-[0.9rem] font-bold text-textPrimary sm:text-sm">{account.label}</span>
                      <span className="mt-1 block truncate text-xs text-textSecondary">{account.email}</span>
                    </div>
                    <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-brand transition-transform group-hover:translate-x-0.5">
                      Use
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-textSecondary/70">
                Demo password: <span className="text-brand">{demoPassword}</span>
              </p>
            </div>

            <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-6 text-sm sm:flex-row sm:items-center">
              <p className="text-textSecondary">
                New to CareCircle?{" "}
                <Link to={inviteToken ? `/signup?inviteToken=${inviteToken}` : "/signup"} className="font-bold text-brand transition-colors hover:text-brandDark">
                  Create account
                </Link>
              </p>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-textSecondary/60">
                Secure, role-based access
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
