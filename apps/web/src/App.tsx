import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { useAppData } from "@/context/AppDataContext";
import { LoadingState } from "@/components/ui";

const OnboardingPage = lazy(async () => ({ default: (await import("@/pages/OnboardingPage")).OnboardingPage }));
const DashboardPage = lazy(async () => ({ default: (await import("@/pages/DashboardPage")).DashboardPage }));
const LoginPage = lazy(async () => ({ default: (await import("@/pages/LoginPage")).LoginPage }));
const MedicationsPage = lazy(async () => ({ default: (await import("@/pages/MedicationsPage")).MedicationsPage }));
const JournalPage = lazy(async () => ({ default: (await import("@/pages/JournalPage")).JournalPage }));
const DocumentsPage = lazy(async () => ({ default: (await import("@/pages/DocumentsPage")).DocumentsPage }));
const AppointmentsPage = lazy(async () => ({ default: (await import("@/pages/AppointmentsPage")).AppointmentsPage }));
const VitalsPage = lazy(async () => ({ default: (await import("@/pages/VitalsPage")).VitalsPage }));
const FamilyPage = lazy(async () => ({ default: (await import("@/pages/FamilyPage")).FamilyPage }));
const TasksPage = lazy(async () => ({ default: (await import("@/pages/TasksPage")).TasksPage }));
const EmergencyPage = lazy(async () => ({ default: (await import("@/pages/EmergencyPage")).EmergencyPage }));
const CareChatPage = lazy(async () => ({ default: (await import("@/pages/CareChatPage")).CareChatPage }));
const SettingsPage = lazy(async () => ({ default: (await import("@/pages/SettingsPage")).SettingsPage }));

const PageTransition = ({ children }: { children: ReactNode }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
    {children}
  </motion.div>
);

const RouteLoadingState = ({ message = "Opening this page..." }: { message?: string }) => (
  <div className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center p-6">
    <LoadingState message={message} />
  </div>
);

const LazyPage = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<RouteLoadingState />}>
    <PageTransition>{children}</PageTransition>
  </Suspense>
);

const App = () => {
  const { bootstrap, loading, error, session } = useAppData();

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
        <LoadingState message="Opening your CareCircle..." />
      </div>
    );
  }

  if (error && session) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">
        <div className="surface-panel max-w-xl p-8 text-center">
          <h1 className="text-3xl font-bold text-textPrimary">CareCircle could not load right now.</h1>
          <p className="mt-3 text-base text-textSecondary">{error ?? "Please try again in a moment."}</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <LazyPage>
            {session ? <Navigate to="/dashboard" replace /> : <LoginPage />}
          </LazyPage>
        )}
      />
      <Route
        path="/onboarding"
        element={(
          <LazyPage>
            {session ? <OnboardingPage /> : <Navigate to="/login" replace />}
          </LazyPage>
        )}
      />
      <Route element={session ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={(
            <LazyPage>
              <DashboardPage />
            </LazyPage>
          )}
        />
        <Route
          path="/medications"
          element={(
            <LazyPage>
              <MedicationsPage />
            </LazyPage>
          )}
        />
        <Route
          path="/journal"
          element={(
            <LazyPage>
              <JournalPage />
            </LazyPage>
          )}
        />
        <Route
          path="/documents"
          element={(
            <LazyPage>
              <DocumentsPage />
            </LazyPage>
          )}
        />
        <Route
          path="/appointments"
          element={(
            <LazyPage>
              <AppointmentsPage />
            </LazyPage>
          )}
        />
        <Route
          path="/vitals"
          element={(
            <LazyPage>
              <VitalsPage />
            </LazyPage>
          )}
        />
        <Route
          path="/family"
          element={(
            <LazyPage>
              <FamilyPage />
            </LazyPage>
          )}
        />
        <Route
          path="/tasks"
          element={(
            <LazyPage>
              <TasksPage />
            </LazyPage>
          )}
        />
        <Route
          path="/emergency"
          element={(
            <LazyPage>
              <EmergencyPage />
            </LazyPage>
          )}
        />
        <Route
          path="/care-chat"
          element={(
            <LazyPage>
              <CareChatPage />
            </LazyPage>
          )}
        />
        <Route
          path="/settings"
          element={(
            <LazyPage>
              <SettingsPage />
            </LazyPage>
          )}
        />
        <Route
          path="*"
          element={(
            <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
              <h1 className="text-4xl font-extrabold text-brandDark">404</h1>
              <p className="mt-2 text-lg text-textSecondary">This page doesn't exist.</p>
            </div>
          )}
        />
      </Route>
    </Routes>
  );
};

export default App;
