import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, Field, Input } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { confirmPasswordReset, loading } = useAppData();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      toast.error("That reset link is missing a token.");
      return;
    }
    if (password.trim().length < 8) {
      toast.error("Please use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      const result = await confirmPasswordReset(token, password);
      toast.success(result.message);
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-xl panel-pad">
        <p className="eyebrow">Password reset</p>
        <h1 className="mt-2 text-3xl font-bold text-textPrimary">Choose a new password</h1>
        <p className="mt-2 text-base text-textSecondary">Use at least 8 characters and something you can remember safely.</p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <Field label="New password">
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
              <Input
                required
                type="password"
                className="pl-11"
                value={password}
                placeholder="Create a new password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </Field>
          <Field label="Confirm new password">
            <Input
              required
              type="password"
              value={confirmPassword}
              placeholder="Repeat the new password"
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={!token}>
            {loading ? "Updating..." : "Update password"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <Link to="/login" className="font-semibold text-brandDark">
            Back to login
          </Link>
          <Link to="/forgot-password" className="font-semibold text-textSecondary">
            Send another link
          </Link>
        </div>
      </Card>
    </div>
  );
};
