import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, HeartHandshake, LockKeyhole, Mail, Stethoscope, Users } from "lucide-react";
import toast from "react-hot-toast";
import type { UserRole } from "@carecircle/shared";
import { Button, Card, Field, Input } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { roleDescription, roleHomePath, roleLabel } from "@/lib/roles";

const roleOptions: Array<{
  role: Exclude<UserRole, "admin">;
  title: string;
  description: string;
  icon: typeof HeartHandshake;
}> = [
  {
    role: "caregiver",
    title: "Main caregiver",
    description: "I manage day-to-day care and the big decisions.",
    icon: HeartHandshake,
  },
  {
    role: "family_member",
    title: "Family member",
    description: "I want to stay informed and help when I can.",
    icon: Users,
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
  const { signup, loading } = useAppData();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "caregiver" as Exclude<UserRole, "admin">,
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
      if (session.viewer.role === "caregiver") {
        navigate("/onboarding", { replace: true });
        return;
      }
      navigate(roleHomePath(session.viewer.role), { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-4 sm:p-6">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card className="overflow-hidden bg-gradient-to-br from-brandDark to-brand p-8 text-white shadow-calm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/75">CareCircle AI</p>
          <h1 className="mt-4 text-4xl font-extrabold">Create the kind of care space you need.</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-white/88">
            Pick the role that matches your work, then build a calmer experience around it.
          </p>
          <div className="mt-8 grid gap-3">
            {roleOptions.map((item) => (
              <div key={item.role} className="rounded-3xl border border-white/15 bg-white/10 p-4">
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-white" />
                  <div>
                    <p className="text-base font-semibold">{roleLabel(item.role)}</p>
                    <p className="text-sm text-white/75">{roleDescription(item.role)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="panel-pad">
          <div className="mx-auto max-w-md">
            <div className="inline-flex rounded-full bg-brandSoft p-3 text-brandDark">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-3xl font-bold text-textPrimary">Sign up</h2>
            <p className="mt-2 text-base text-textSecondary">Choose the role that matches your place in the care team.</p>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              <Field label="Full name">
                <Input
                  required
                  value={form.name}
                  placeholder="Sarah Martinez"
                  className={errors.name ? "border-danger" : ""}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
                {errors.name ? <p className="mt-2 text-sm text-danger">{errors.name}</p> : null}
              </Field>
              <Field label="Email address">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
                  <Input
                    required
                    type="email"
                    className={`pl-11 ${errors.email ? "border-danger" : ""}`}
                    value={form.email}
                    placeholder="you@example.com"
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </div>
                {errors.email ? <p className="mt-2 text-sm text-danger">{errors.email}</p> : null}
              </Field>
              <Field label="Password">
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
                  <Input
                    required
                    type="password"
                    className={`pl-11 ${errors.password ? "border-danger" : ""}`}
                    value={form.password}
                    placeholder="Create a password"
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  />
                </div>
                {errors.password ? <p className="mt-2 text-sm text-danger">{errors.password}</p> : null}
              </Field>
              <Field label="Confirm password">
                <Input
                  required
                  type="password"
                  className={errors.confirmPassword ? "border-danger" : ""}
                  value={form.confirmPassword}
                  placeholder="Repeat your password"
                  onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                />
                {errors.confirmPassword ? <p className="mt-2 text-sm text-danger">{errors.confirmPassword}</p> : null}
              </Field>

              <Field label="Your role">
                <div className="grid gap-3">
                  {roleOptions.map((item) => {
                    const selected = form.role === item.role;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.role}
                        type="button"
                        className={`rounded-3xl border p-4 text-left transition ${selected ? "border-brand bg-brandSoft" : "border-borderColor bg-white hover:bg-slate-50"}`}
                        onClick={() => setForm((current) => ({ ...current, role: item.role }))}
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl bg-white p-3 text-brandDark shadow-sm">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-textPrimary">{item.title}</p>
                            <p className="mt-1 text-sm leading-7 text-textSecondary">{item.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {selectedRole.role === "doctor" ? (
                <Field label="Medical license number">
                  <Input
                    required
                    value={form.licenseNumber}
                    placeholder="MED-12345"
                    className={errors.licenseNumber ? "border-danger" : ""}
                    onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))}
                  />
                  {errors.licenseNumber ? <p className="mt-2 text-sm text-danger">{errors.licenseNumber}</p> : null}
                </Field>
              ) : null}

              <Button type="submit" className="mt-2 w-full">
                {loading ? "Creating account..." : "Create account"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 rounded-3xl bg-brandSoft/55 p-4">
              <p className="text-sm font-semibold text-textPrimary">Already have an account?</p>
              <Link to={inviteToken ? `/login?inviteToken=${inviteToken}` : "/login"} className="mt-1 inline-flex text-sm font-semibold text-brandDark">
                Back to sign in
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
