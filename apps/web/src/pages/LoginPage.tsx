import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { HeartHandshake, LockKeyhole, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, Field, Input } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { roleHomePath } from "@/lib/roles";

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loading } = useAppData();
  const [email, setEmail] = useState("demo@carecircle.ai");
  const [password, setPassword] = useState("Demo1234");
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
      navigate(roleHomePath(session.viewer.role), { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-4 sm:p-6">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="overflow-hidden bg-gradient-to-br from-brand to-brandDark p-8 text-white shadow-calm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/75">CareCircle AI</p>
          <h1 className="mt-4 text-4xl font-extrabold">You are not alone in this.</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-white/88">
            Medications, doctor visits, emergency plans, family updates, and AI support live in one calm place.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              "Daily AI briefing",
              "One-tap emergency help",
              "Simple family coordination",
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-white/15 bg-white/10 p-4 text-base font-semibold">
                {item}
              </div>
            ))}
          </div>
        </Card>

        <Card className="panel-pad">
          <div className="mx-auto max-w-md">
            <div className="inline-flex rounded-full bg-brandSoft p-3 text-brandDark">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-3xl font-bold text-textPrimary">Sign in</h2>
            <p className="mt-2 text-base text-textSecondary">
              Use the demo account below or your real CareCircle login.
            </p>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              <Field label="Email address">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
                  <Input
                    required
                    type="email"
                    className="pl-11"
                    value={email}
                    placeholder="demo@carecircle.ai"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </Field>
              <Field label="Password">
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
                  <Input
                    required
                    type="password"
                    className="pl-11"
                    value={password}
                    placeholder="Demo1234"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </Field>
              <Button type="submit" className="mt-2 w-full">
                {loading ? "Opening CareCircle..." : "Open CareCircle"}
              </Button>
            </form>

            <div className="mt-6 rounded-3xl bg-brandSoft/55 p-4">
              <p className="text-sm font-semibold text-textPrimary">Demo login</p>
              <p className="mt-1 text-sm text-textSecondary">demo@carecircle.ai</p>
              <p className="text-sm text-textSecondary">Demo1234</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              <Link to={inviteToken ? `/signup?inviteToken=${inviteToken}` : "/signup"} className="font-semibold text-brandDark">
                Create an account
              </Link>
              <Link to="/forgot-password" className="font-semibold text-textSecondary">
                Forgot password?
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
