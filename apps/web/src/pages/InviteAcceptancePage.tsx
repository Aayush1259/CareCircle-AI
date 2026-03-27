import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ShieldCheck, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import type { PatientAccessRole } from "@carecircle/shared";
import { Button, Card } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { resolveViewerRole, roleHomePath } from "@/lib/roles";

export const InviteAcceptancePage = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { session, request, refresh, loading, logout } = useAppData();
  const [status, setStatus] = useState<"waiting" | "accepting" | "accepted" | "error">("waiting");
  const [message, setMessage] = useState("Please sign in with the invited email address to accept this invite.");
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!token || !session || attemptedRef.current) return;

    attemptedRef.current = true;
    setStatus("accepting");

    void (async () => {
      try {
        const result = await request<{ invite: { accessRole?: PatientAccessRole } }>(`/family/invite/${token}/accept`, { method: "POST" });
        await refresh();
        setStatus("accepted");
        toast.success("Invite accepted.");
        navigate(
          roleHomePath(resolveViewerRole(session.viewer.role, result.invite.accessRole ?? session.access?.accessRole)),
          { replace: true },
        );
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "We could not accept this invite right now.");
      }
    })();
  }, [navigate, refresh, request, session, token]);

  const invitePath = `/login?inviteToken=${encodeURIComponent(token)}`;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-4 sm:p-6">
      <Card className="panel-pad w-full max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brandSoft text-brandDark">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-3xl font-bold text-textPrimary">Accept your CareCircle invite</h1>
        <p className="mt-3 text-base leading-7 text-textSecondary">
          {session ? "We are checking that this account matches the invited email address." : message}
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-textSecondary">Opening your account...</p>
        ) : session ? (
          <div className="mt-6 rounded-3xl border border-borderColor bg-slate-50 p-5 text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-textSecondary">Signed in as</p>
            <p className="mt-2 text-lg font-bold text-textPrimary">{session.viewer.name}</p>
            <p className="text-sm text-textSecondary">{session.viewer.email}</p>
            <p className="mt-4 text-sm text-textSecondary">
              If this matches the invited email, the invite will be accepted automatically.
            </p>
            {status === "error" ? <p className="mt-4 text-sm font-semibold text-danger">{message}</p> : null}
            {status === "error" ? (
              <Button variant="secondary" className="mt-4 w-full" onClick={async () => { await logout(); navigate(invitePath, { replace: true }); }}>
                Sign out and try again
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button className="w-full" onClick={() => navigate(invitePath)}>
              <UserPlus className="h-4 w-4" />
              Sign in to accept
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => navigate(`/signup?inviteToken=${encodeURIComponent(token)}`)}>
              Create account
            </Button>
          </div>
        )}

        <p className="mt-6 text-sm text-textSecondary">
          Need a different account?{" "}
          <Link className="font-semibold text-brandDark" to={invitePath}>
            Go back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
};
