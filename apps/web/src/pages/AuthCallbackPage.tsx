import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { LoadingState } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { resolveViewerRole, roleHomePath } from "@/lib/roles";

export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, bootstrap, loading, completeGoogleAuth } = useAppData();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    const inviteToken = params.get("inviteToken");
    const code = params.get("code");
    const providerError = params.get("error_description") || params.get("error");
    const next = params.get("next");

    if ((code || providerError) && !attemptedRef.current) {
      attemptedRef.current = true;
      void (async () => {
        try {
          const payload = await completeGoogleAuth();
          if (payload.inviteToken || inviteToken) {
            navigate(`/invite/${encodeURIComponent(payload.inviteToken ?? inviteToken ?? "")}`, { replace: true });
            return;
          }
          navigate(
            next ?? roleHomePath(resolveViewerRole(payload.session.viewer.role, payload.session.access?.accessRole)),
            { replace: true },
          );
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Google sign-in could not be completed.");
          navigate("/login", { replace: true });
        }
      })();
      return;
    }

    if (session || bootstrap) {
      navigate(
        next ??
          roleHomePath(
            resolveViewerRole(
              session?.viewer.role ?? bootstrap?.viewer.role,
              session?.access?.accessRole ?? bootstrap?.viewerAccess?.accessRole,
            ),
          ),
        { replace: true },
      );
      return;
    }
    navigate("/login", { replace: true });
  }, [bootstrap, completeGoogleAuth, loading, navigate, params, session]);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">
      <LoadingState message="Completing sign in..." />
    </div>
  );
};
