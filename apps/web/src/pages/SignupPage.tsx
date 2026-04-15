import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Chrome, HeartHandshake, LockKeyhole, Mail, Stethoscope, Users as UsersIcon, Check } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { UserRole } from "@carecircle/shared";
import { Button, Field, Input } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { resolveViewerRole, roleDescription, roleHomePath, roleLabel } from "@/lib/roles";
import { hasBrowserSupabaseAuth } from "@/lib/supabaseBrowser";

const roleOptions: Array<{
  role: Exclude<UserRole, "admin" | "caregiver">;
  title: string;
  description: string;
  icon: typeof HeartHandshake;
}> = [
  {
    role: "primary_caregiver",
    title: "Primary caregiver",
    description: "I manage day-to-day care and the big decisions.",
    icon: HeartHandshake,
  },
  {
    role: "secondary_caregiver",
    title: "Co-caregiver",
    description: "I actively assist the primary caregiver.",
    icon: HeartHandshake,
  },
  {
    role: "family_member",
    title: "Family member",
    description: "I want to stay informed and help when I can.",
    icon: UsersIcon,
  },
  {
    role: "doctor",
    title: "Doctor or provider",
    description: "I need a clear clinical view for patient care.",
    icon: Stethoscope,
  },
];

export const SignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup, loading, startGoogleAuth, appConfig } = useAppData();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "primary_caregiver" as Exclude<UserRole, "admin" | "caregiver">,
    licenseNumber: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedRole = useMemo(() => roleOptions.find((item) => item.role === form.role) ?? roleOptions[0], [form.role]);
  const inviteToken = searchParams.get("inviteToken");

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Please enter your name.";
    if (!form.email.trim()) nextErrors.email = "Please enter an email address.";
    if (!form.password.trim() || form.password.trim().length < 8) nextErrors.password = "Use at least 8 characters.";
    if (form.password !== form.confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    if (form.role === "secondary_caregiver" && !inviteToken) {
      nextErrors.role = "Secondary caregivers join through an invite from the primary caregiver.";
    }
    if (form.role === "doctor" && !form.licenseNumber.trim()) nextErrors.licenseNumber = "Please add your license number.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    try {
      const session = await signup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        licenseNumber: form.role === "doctor" ? form.licenseNumber.trim() : undefined,
      });

      toast.success("Account created.");
      if (inviteToken) {
        navigate(`/invite/${inviteToken}`, { replace: true });
        return;
      }
      const viewerRole = resolveViewerRole(session.viewer.role, session.access?.accessRole);
      if (viewerRole === "primary_caregiver") {
        navigate("/onboarding", { replace: true });
        return;
      }
      navigate(roleHomePath(viewerRole), { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const handleGoogleSignup = async () => {
    if (form.role === "secondary_caregiver" && !inviteToken) {
      setErrors((current) => ({ ...current, role: "Secondary caregivers join through an invite from the primary caregiver." }));
      return;
    }
    if (form.role === "doctor" && !form.licenseNumber.trim()) {
      setErrors((current) => ({ ...current, licenseNumber: "Please add your license number." }));
      return;
    }

    try {
      await startGoogleAuth({
        mode: "signup",
        role: form.role,
        name: form.name.trim() || undefined,
        licenseNumber: form.role === "doctor" ? form.licenseNumber.trim() : undefined,
        inviteToken: inviteToken ?? undefined,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-up is not ready right now.");
    }
  };

  return (
    <div className="flex min-h-screen min-h-[100svh] w-full bg-bg">
      <div className="relative hidden w-[46%] overflow-hidden lg:block">
        <div className="absolute inset-0 bg-brandDark" />
        <motion.div
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 0.34, scale: 1 }}
          transition={{ duration: 1.4 }}
          className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=2080&auto=format&fit=crop')] bg-cover bg-center"
        />
        <div className="absolute inset-0 z-10 bg-[linear-gradient(145deg,rgba(99,102,241,0.38),rgba(30,41,59,0.88))]" />

        <div className="absolute inset-0 z-20 flex flex-col justify-between p-10 text-white xl:p-16">
          <motion.div
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.3em] text-white/78 backdrop-blur-md"
          >
            Guided Onboarding
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="max-w-2xl"
          >
            <p className="font-['Outfit'] text-sm font-bold uppercase tracking-[0.24em] text-white/60">CareCircle AI</p>
            <h1 className="hero-display mt-6">
              Build a care hub that feels calm, coordinated, and trustworthy.
            </h1>
            <p className="hero-body-copy mt-6 max-w-xl text-white/80 sm:text-lg">
              Choose the role that fits your place in the care circle, then move into a workspace tailored for the responsibilities that come with it.
            </p>

            <div className="mt-10 grid gap-4">
              {roleOptions.map((item, index) => (
                <motion.div
                  key={item.role}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + index * 0.08 }}
                  className={`flex items-center gap-4 rounded-[1.6rem] border p-5 backdrop-blur-md transition-all ${
                    form.role === item.role ? "border-white/15 bg-white/15 shadow-xl" : "border-white/10 bg-white/6"
                  }`}
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${form.role === item.role ? "bg-white text-brand" : "bg-white/10 text-white"}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{roleLabel(item.role)}</p>
                    <p className="text-xs text-white/65">{roleDescription(item.role)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex w-full flex-col overflow-y-auto px-3 py-4 sm:px-6 sm:py-8 lg:w-[54%] lg:px-10 lg:py-10">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto w-full max-w-3xl space-y-5"
        >
          <div className="rounded-[1.8rem] border border-white/80 bg-white/82 p-4 shadow-premium backdrop-blur-2xl sm:rounded-[2rem] sm:p-5 lg:hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-['Outfit'] text-[0.72rem] font-bold uppercase tracking-[0.22em] text-brand/80">CareCircle AI</p>
                <h1 className="mt-2 font-['Outfit'] text-[1.65rem] font-bold tracking-tight text-textPrimary sm:text-2xl">Create your care workspace.</h1>
              </div>
              <div className="rounded-[1.4rem] bg-brandSoft p-3 text-brandDark shadow-sm">
                <HeartHandshake className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-4 text-[0.9rem] leading-6 text-textSecondary sm:text-sm">
              Select your role, set up your secure account, and start with a workflow designed for how you actually support care.
            </p>
          </div>

          {inviteToken ? (
            <div className="rounded-[1.6rem] border border-brand/15 bg-brandSoft/60 px-5 py-4 text-sm font-medium text-brandDark">
              You&apos;re signing up from an invitation. We&apos;ll connect you to the right care team as soon as your account is created.
            </div>
          ) : null}

          <div className="rounded-[2.25rem] border border-white/80 bg-white/84 p-5 shadow-premium backdrop-blur-2xl sm:p-8 lg:p-10">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-['Outfit'] text-[0.74rem] font-bold uppercase tracking-[0.24em] text-brand/75">Join CareCircle</p>
                <h2 className="responsive-title-xl mt-3 text-textPrimary">Set up a role-aware account</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-textSecondary sm:text-base sm:leading-7">
                  Choose how you participate in care, then we&apos;ll keep the interface focused on the information and actions that matter to you.
                </p>
              </div>
              <div className="hidden rounded-[1.5rem] bg-brandSoft p-4 text-brandDark shadow-sm sm:flex">
                <HeartHandshake className="h-7 w-7" />
              </div>
            </div>

            <form className="grid gap-8" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {roleOptions.map((item) => {
                  const selected = form.role === item.role;
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.role}
                      type="button"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`relative overflow-hidden rounded-[1.55rem] border p-4 text-left transition-all duration-300 sm:rounded-[1.9rem] sm:p-6 ${
                        selected
                          ? "border-brand/25 bg-brandSoft/58 shadow-[0_18px_34px_-24px_rgba(79,70,229,0.72)]"
                          : "border-slate-200/85 bg-white hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-premium"
                      }`}
                      onClick={() => setForm((current) => ({ ...current, role: item.role }))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={`rounded-[1rem] p-3 ${selected ? "bg-white text-brand shadow-sm" : "bg-slate-50 text-textPrimary"} sm:rounded-[1.15rem] sm:p-3.5`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        {selected ? (
                          <div className="rounded-full bg-brand p-1 text-white shadow-lg">
                            <Check className="h-4 w-4" />
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-4 font-['Outfit'] text-base font-bold text-textPrimary sm:mt-5 sm:text-lg">{item.title}</p>
                      <p className="mt-2 text-[0.88rem] leading-6 text-textSecondary sm:text-sm">{item.description}</p>
                    </motion.button>
                  );
                })}
              </div>

              {errors.role ? <p className="text-sm font-bold text-danger">{errors.role}</p> : null}

              <div className="rounded-[1.6rem] border border-slate-200/75 bg-slate-50/72 p-4 sm:rounded-[1.8rem] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-['Outfit'] text-sm font-bold uppercase tracking-[0.18em] text-textPrimary">Selected role</p>
                    <p className="mt-2 text-base font-semibold text-textPrimary sm:text-lg">{selectedRole.title}</p>
                    <p className="mt-1 text-[0.88rem] leading-6 text-textSecondary sm:text-sm">{roleDescription(selectedRole.role)}</p>
                  </div>
                  <div className="w-full rounded-[1.2rem] bg-white px-4 py-3 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.45)] ring-1 ring-slate-100 sm:w-auto sm:rounded-[1.4rem]">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-textSecondary/70">Access model</p>
                    <p className="mt-1 text-[0.92rem] font-semibold text-textPrimary sm:text-base">
                      {selectedRole.role === "doctor" ? "Clinical review workflow" : selectedRole.role === "family_member" ? "Read-and-support access" : "Care management workflow"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Field label="Full name">
                  <Input
                    required
                    value={form.name}
                    placeholder="Sarah Martinez"
                    className={errors.name ? "border-danger ring-danger/10" : ""}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </Field>
                <Field label="Email address">
                  <div className="relative group">
                    <Mail className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-textSecondary transition-colors group-focus-within:text-brand" />
                    <Input
                      required
                      type="email"
                      className={`pl-14 ${errors.email ? "border-danger ring-danger/10" : ""}`}
                      value={form.email}
                      placeholder="you@example.com"
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </div>
                </Field>
                <Field label="Password" hint="At least 8 characters">
                  <div className="relative group">
                    <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-textSecondary transition-colors group-focus-within:text-brand" />
                    <Input
                      required
                      type="password"
                      className={`pl-14 ${errors.password ? "border-danger ring-danger/10" : ""}`}
                      value={form.password}
                      placeholder="••••••••"
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    />
                  </div>
                </Field>
                <Field label="Confirm password">
                  <Input
                    required
                    type="password"
                    className={errors.confirmPassword ? "border-danger ring-danger/10" : ""}
                    value={form.confirmPassword}
                    placeholder="Repeat password"
                    onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  />
                </Field>
              </div>

              <AnimatePresence>
                {form.role === "doctor" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Field label="Medical license number">
                      <Input
                        required
                        value={form.licenseNumber}
                        placeholder="MED-12345"
                        className={errors.licenseNumber ? "border-danger ring-danger/10" : ""}
                        onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))}
                      />
                    </Field>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <Button type="submit" className="group w-full overflow-hidden">
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? "Creating account..." : "Create account"}
                    {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                  </span>
                </Button>

                {hasBrowserSupabaseAuth && appConfig.googleAuthEnabled ? (
                  <Button variant="ghost" className="w-full" disabled={loading} onClick={() => void handleGoogleSignup()}>
                    <Chrome className="h-5 w-5" />
                    Continue with Google
                  </Button>
                ) : null}
              </div>
            </form>

            <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-6 text-sm sm:flex-row sm:items-center">
              <p className="text-textSecondary/85">
                Already have an account?{" "}
                <Link to={inviteToken ? `/login?inviteToken=${inviteToken}` : "/login"} className="font-bold text-brand transition-colors hover:text-brandDark">
                  Back to sign in
                </Link>
              </p>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-textSecondary/60">
                Professional, role-based onboarding
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
