import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoadingState } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { roleHomePath } from "@/lib/roles";

export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, bootstrap, loading } = useAppData();

  useEffect(() => {
    if (loading) return;
    const next = params.get("next");
    if (session || bootstrap) {
      navigate(next ?? roleHomePath(session?.viewer.role ?? bootstrap?.viewer.role), { replace: true });
      return;
    }
    navigate("/login", { replace: true });
  }, [bootstrap, loading, navigate, params, session]);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">
      <LoadingState message="Completing sign in..." />
    </div>
  );
};
