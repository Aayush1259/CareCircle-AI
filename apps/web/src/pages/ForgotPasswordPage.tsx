import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, Field, Input } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { requestPasswordReset, loading } = useAppData();
  const [email, setEmail] = useState("demo@carecircle.ai");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await requestPasswordReset(email);
      toast.success(result.message);
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-xl panel-pad">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mt-2 text-3xl font-bold text-textPrimary">Reset your password</h1>
        <p className="mt-2 text-base text-textSecondary">We'll send a reset link to the email address on the account.</p>

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
          <Button type="submit" className="w-full">
            {loading ? "Sending link..." : "Send reset link"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <Link to="/login" className="font-semibold text-brandDark">
            Back to login
          </Link>
          <Link to="/signup" className="font-semibold text-textSecondary">
            Create account
          </Link>
        </div>
      </Card>
    </div>
  );
};
