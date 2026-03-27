import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookHeart,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Home,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pill,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import type { PatientCapability, UserRole } from "@carecircle/shared";
import { calcAge, relativeTime, sentenceCase } from "@/lib/format";
import { useAppData } from "@/context/AppDataContext";
import { resolveViewerRole, roleAllowedPaths, roleHomePath, roleLabel } from "@/lib/roles";
import { Badge, Button, Modal, cn } from "./ui";
import { CareChatAssistant } from "./CareChatAssistant";

interface NavigationItem {
  to: string;
  label: string;
  icon: typeof Home;
  shortLabel?: string;
  requiredCapability?: PatientCapability;
}

const caregiverNavigation: NavigationItem[] = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: Home },
  { to: "/medications", label: "Medications", shortLabel: "Meds", icon: Pill, requiredCapability: "view_medications" },
  { to: "/journal", label: "Care Journal", shortLabel: "Journal", icon: BookHeart, requiredCapability: "view_journal" },
  { to: "/documents", label: "Documents", shortLabel: "Docs", icon: FileText, requiredCapability: "view_documents" },
  { to: "/appointments", label: "Appointments", shortLabel: "Appts", icon: CalendarDays, requiredCapability: "view_appointments" },
  { to: "/vitals", label: "Health Vitals", shortLabel: "Vitals", icon: HeartPulse, requiredCapability: "view_vitals" },
  { to: "/family", label: "Family Hub", shortLabel: "Family", icon: Users, requiredCapability: "view_family" },
  { to: "/tasks", label: "Tasks", shortLabel: "Tasks", icon: ClipboardCheck, requiredCapability: "view_tasks" },
  { to: "/emergency", label: "Emergency", shortLabel: "SOS", icon: ShieldAlert, requiredCapability: "view_emergency" },
];

const familyNavigation: NavigationItem[] = [
  { to: "/family-home", label: "Home", shortLabel: "Home", icon: Home },
  { to: "/medications", label: "Medications", shortLabel: "Meds", icon: Pill, requiredCapability: "view_medications" },
  { to: "/tasks", label: "My Tasks", shortLabel: "Tasks", icon: ClipboardCheck, requiredCapability: "view_tasks" },
  { to: "/family", label: "Family Chat", shortLabel: "Family", icon: Users, requiredCapability: "view_family" },
  { to: "/appointments", label: "Appointments", shortLabel: "Appts", icon: CalendarDays, requiredCapability: "view_appointments" },
  { to: "/journal", label: "Care Journal", shortLabel: "Journal", icon: BookHeart, requiredCapability: "view_journal" },
  { to: "/vitals", label: "Health Vitals", shortLabel: "Vitals", icon: HeartPulse, requiredCapability: "view_vitals" },
  { to: "/emergency", label: "Emergency", shortLabel: "SOS", icon: ShieldAlert, requiredCapability: "view_emergency" },
];

const doctorNavigation: NavigationItem[] = [
  { to: "/doctor-home", label: "Home", shortLabel: "Home", icon: Home },
  { to: "/journal", label: "Care Journal", shortLabel: "Journal", icon: BookHeart, requiredCapability: "view_journal" },
  { to: "/documents", label: "Medical Documents", shortLabel: "Docs", icon: FileText, requiredCapability: "view_documents" },
  { to: "/vitals", label: "Health Vitals", shortLabel: "Vitals", icon: HeartPulse, requiredCapability: "view_vitals" },
  { to: "/appointments", label: "My Appointments", shortLabel: "Appts", icon: CalendarDays, requiredCapability: "view_appointments" },
  { to: "/emergency", label: "Emergency", shortLabel: "SOS", icon: ShieldAlert, requiredCapability: "view_emergency" },
];

export const AppShell = () => {
  const { bootstrap, request, refresh, logout } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();
  const dragControls = useDragControls();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const viewerRole = resolveViewerRole(
    bootstrap?.viewer.role ?? "caregiver",
    bootstrap?.viewerAccess?.accessRole,
  ) as UserRole;
  const capabilities = bootstrap?.capabilities ?? [];
  const hasCapability = useCallback(
    (capability?: PatientCapability) => !capability || capabilities.includes(capability),
    [capabilities],
  );
  const navigation = useMemo(
    () =>
      (viewerRole === "family_member" ? familyNavigation : viewerRole === "doctor" ? doctorNavigation : caregiverNavigation)
        .filter((item) => hasCapability(item.requiredCapability)),
    [hasCapability, viewerRole],
  );
  const mobilePrimaryTabs = useMemo(() => navigation.slice(0, 5), [navigation]);
  const allowedPaths = useMemo(() => roleAllowedPaths(viewerRole, capabilities), [capabilities, viewerRole]);
  const canManageFamily = capabilities.includes("manage_family");
  const canViewInsurance = capabilities.includes("view_insurance");
  const canViewAuditLog = capabilities.includes("view_audit_log");
  const openSettingsSection = (section: "profile" | "preferences" | "privacy" | "access") => {
    navigate(`/settings?section=${section}`);
    setProfileOpen(false);
  };

  useEffect(() => {
    if (location.pathname.startsWith("/care-chat")) {
      setChatOpen(true);
      navigate(roleHomePath(viewerRole), { replace: true });
    }
  }, [location.pathname, navigate, viewerRole]);

  useEffect(() => {
    const isAllowed = allowedPaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
    if (!isAllowed && location.pathname !== "/") {
      navigate(roleHomePath(viewerRole), { replace: true });
    }
  }, [allowedPaths, location.pathname, navigate, viewerRole]);

  const pageTitle = useMemo(
    () => {
      if (location.pathname.startsWith("/settings")) return "Settings";
      return navigation.find((item) => location.pathname.startsWith(item.to))?.label ?? "CareCircle AI";
    },
    [location.pathname, navigation],
  );

  if (!bootstrap) return null;

  const notifications = [...bootstrap.data.notifications].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const patient = bootstrap.patient;
  const activeInsights = bootstrap.data.aiInsights.filter((item) => !item.isRead && !item.isDismissed);
  const chatBadgeCount = activeInsights.length || unreadCount;
  const patientLabel = `${patient.preferredName ?? patient.name} - ${calcAge(patient.dateOfBirth)}`;
  const criticalMeds = bootstrap.data.medications.filter((item) => item.isActive).slice(0, 5);
  const roleTitle = roleLabel(viewerRole);
  const headerTitle =
    viewerRole === "doctor"
      ? `${bootstrap.viewer.name} is reviewing ${patient.preferredName ?? patient.name}`
      : `${bootstrap.viewer.name.split(" ")[0]} is caring for ${patient.preferredName ?? patient.name}`;

  const markNotificationRead = async (notificationId: string) => {
    try {
      setNotificationsSaving(true);
      await request(`/notifications/${notificationId}/read`, {
        method: "PATCH",
        body: JSON.stringify({ isRead: true }),
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setNotificationsSaving(false);
    }
  };

  const markAllNotificationsRead = async () => {
    const unreadNotifications = notifications.filter((item) => !item.isRead);
    if (!unreadNotifications.length) return;

    try {
      setNotificationsSaving(true);
      await Promise.all(
        unreadNotifications.map((notification) =>
          request(`/notifications/${notification.id}/read`, {
            method: "PATCH",
            body: JSON.stringify({ isRead: true }),
          }),
        ),
      );
      toast.success("Notifications marked read.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setNotificationsSaving(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-transparent text-textPrimary">
      <aside className="sidebar-scroll fixed left-0 top-0 hidden h-screen w-[290px] overflow-y-auto border-r border-borderColor/70 bg-surface/95 px-5 py-6 backdrop-blur lg:flex lg:flex-col">
        <div className="rounded-3xl bg-gradient-to-br from-brand to-brandDark p-5 text-white shadow-calm">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/80">CareCircle AI</p>
          <h1 className="mt-3 text-2xl font-extrabold">Calm, clear care for every day.</h1>
          <p className="mt-2 text-base leading-7 text-white/85">
            One place for medications, notes, family updates, emergencies, and support.
          </p>
          <div className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
            {roleTitle}
          </div>
        </div>

        <nav aria-label="Primary navigation" className="mt-8 flex-1 space-y-2">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  isActive ? "bg-brandSoft text-brandDark" : "text-textSecondary hover:bg-slate-50 hover:text-textPrimary",
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
              {label === "Family Hub" ? <span className="ml-auto h-2.5 w-2.5 rounded-full bg-success" aria-label="Live updates enabled" /> : null}
            </NavLink>
          ))}
        </nav>

        <div className="surface-panel mt-6 p-4">
          <p className="text-sm font-semibold text-textPrimary">{patient.preferredName ?? patient.name}</p>
          <p className="mt-1 text-sm text-textSecondary">
            {calcAge(patient.dateOfBirth)} years old, {patient.primaryDiagnosis}
          </p>
          <Badge tone="brand" >
            {patient.primaryDoctorName}
          </Badge>
        </div>
      </aside>

      <div className="min-w-0 overflow-x-hidden lg:pl-[290px]">
        <header className="sticky top-0 z-40 border-b border-borderColor/80 bg-bg/92 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1280px] min-w-0 items-center gap-3 px-4 py-4 sm:px-6">
            <button
              type="button"
              className="rounded-2xl border border-borderColor bg-surface p-3 shadow-sm lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-textSecondary">{pageTitle}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold text-textPrimary">
                  {headerTitle}
                </h2>
                <span className="rounded-full bg-brandSoft px-3 py-1 text-sm font-semibold text-brandDark">{patientLabel}</span>
                <Badge tone="brand">{roleTitle}</Badge>
              </div>
            </div>

            <Button variant="danger" className="hidden md:inline-flex" onClick={() => setEmergencyOpen(true)}>
              <ShieldAlert className="h-4 w-4" />
              I need help now
            </Button>

            <button
              type="button"
              className="relative rounded-2xl border border-borderColor bg-surface p-3 shadow-sm transition hover:bg-slate-50"
              aria-label="Open notifications"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell className="h-5 w-5 text-textPrimary" />
              {unreadCount ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </button>

            <div className="relative">
              <button
                type="button"
                className="flex min-h-12 items-center gap-2 rounded-2xl border border-borderColor bg-surface px-3 py-2 shadow-sm transition hover:bg-slate-50"
                onClick={() => setProfileOpen((current) => !current)}
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brandSoft text-brandDark">
                  <span className="text-sm font-bold">{bootstrap.viewer.name.slice(0, 1)}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-textSecondary" />
              </button>

              {profileOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 rounded-3xl border border-borderColor bg-surface p-2 shadow-xl">
                  <button type="button" className="w-full rounded-2xl px-4 py-3 text-left text-base font-semibold text-textPrimary hover:bg-slate-50" onClick={() => openSettingsSection("profile")}>
                    My profile
                  </button>
                  <button type="button" className="w-full rounded-2xl px-4 py-3 text-left text-base font-semibold text-textPrimary hover:bg-slate-50" onClick={() => openSettingsSection("preferences")}>
                    App preferences
                  </button>
                  <button type="button" className="w-full rounded-2xl px-4 py-3 text-left text-base font-semibold text-textPrimary hover:bg-slate-50" onClick={() => openSettingsSection("privacy")}>
                    Access & privacy
                  </button>
                  {canManageFamily || canViewAuditLog ? (
                    <button type="button" className="w-full rounded-2xl px-4 py-3 text-left text-base font-semibold text-textPrimary hover:bg-slate-50" onClick={() => openSettingsSection("access")}>
                      Sharing access
                    </button>
                  ) : null}
                  <button type="button" className="w-full rounded-2xl px-4 py-3 text-left text-base font-semibold text-textPrimary hover:bg-slate-50" onClick={() => { setProfileOpen(false); toast("One patient is active in this demo."); }}>
                    Switch patient
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-2xl px-4 py-3 text-left text-base font-semibold text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setProfileOpen(false);
                      void logout();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main role="main" className="mx-auto w-full max-w-[1280px] min-w-0 flex-1 px-4 py-6 pb-44 sm:px-6 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borderColor bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" aria-label="Mobile navigation">
        <div className="mx-auto grid max-w-xl grid-cols-6 gap-1">
          {mobilePrimaryTabs.map(({ to, shortLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[0.74rem] font-semibold",
                  isActive ? "bg-brandSoft text-brandDark" : "text-textSecondary",
                )
              }
            >
              <Icon className="mb-1 h-5 w-5" />
              {shortLabel}
            </NavLink>
          ))}
          <button
            type="button"
            className="flex min-h-12 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[0.74rem] font-semibold text-textSecondary"
            onClick={() => setMoreOpen(true)}
            aria-label="Open more pages"
          >
            <MoreHorizontal className="mb-1 h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <button
        type="button"
        className="group fixed bottom-[84px] right-5 z-[9999] flex h-[56px] w-[56px] items-center justify-center rounded-full bg-gradient-to-br from-brand to-brandDark text-white shadow-[0_8px_28px_rgba(13,148,136,0.45)] transition-all duration-200 hover:scale-[1.08] hover:shadow-[0_10px_36px_rgba(13,148,136,0.55)] active:scale-95 lg:bottom-7 lg:right-7"
        onClick={() => setChatOpen(true)}
        aria-label="Open CareCircle AI chat"
      >
        {activeInsights.length ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" />
        ) : null}
        <MessageCircle className="relative h-[26px] w-[26px] transition-transform group-hover:rotate-[-8deg]" />
        {chatBadgeCount ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-sm">
            {chatBadgeCount > 9 ? "9+" : chatBadgeCount}
          </span>
        ) : null}
      </button>

      <Modal open={menuOpen} title="Navigation" onClose={() => setMenuOpen(false)}>
        <div className="grid gap-3">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-2xl border border-borderColor p-4 text-base font-semibold text-textPrimary"
            >
              <Icon className="h-5 w-5 text-brandDark" />
              {label}
            </Link>
          ))}
        </div>
      </Modal>

      <Modal open={moreOpen} title="More places to go" onClose={() => setMoreOpen(false)}>
        <div className="grid gap-3">
          {navigation
            .filter((item) => !mobilePrimaryTabs.some((tab) => tab.to === item.to))
            .map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-12 items-center gap-3 rounded-2xl border border-borderColor p-4 text-base font-semibold text-textPrimary"
              >
                <Icon className="h-5 w-5 text-brandDark" />
                {label}
              </Link>
            ))}
          <Link
            to="/settings?section=profile"
            onClick={() => setMoreOpen(false)}
            className="flex min-h-12 items-center gap-3 rounded-2xl border border-borderColor p-4 text-base font-semibold text-textPrimary"
          >
            My profile & preferences
          </Link>
          <Button onClick={() => { setMoreOpen(false); setChatOpen(true); }}>
            <MessageCircle className="h-4 w-4" />
            Open CareCircle AI
          </Button>
        </div>
      </Modal>

      <Modal open={emergencyOpen} title="Emergency quick access" onClose={() => setEmergencyOpen(false)}>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <a href="tel:911" className="rounded-3xl bg-danger p-5 text-center text-lg font-bold text-white">
              Call 911
            </a>
            <a
              href={`tel:${patient.primaryDoctorPhone.replaceAll(/[^0-9]/g, "")}`}
              className="rounded-3xl bg-brand p-5 text-center text-lg font-bold text-white"
            >
              Call primary doctor
            </a>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <h3 className="text-lg font-bold text-textPrimary">Critical info in one place</h3>
            <div className="mt-3 grid gap-3 text-sm text-textSecondary sm:grid-cols-2">
              <p><strong className="text-textPrimary">Blood type:</strong> {patient.bloodType}</p>
              <p><strong className="text-textPrimary">Allergies:</strong> {patient.allergies.join(", ")}</p>
              {canViewInsurance ? (
                <>
                  <p><strong className="text-textPrimary">Insurance:</strong> {patient.insuranceProvider}</p>
                  <p><strong className="text-textPrimary">ID:</strong> {patient.insuranceId}</p>
                </>
              ) : null}
            </div>
            <div className="mt-4 rounded-2xl border border-borderColor bg-surface p-4">
              <p className="text-sm font-semibold text-textPrimary">Current medications</p>
              <ul className="mt-2 space-y-2 text-sm text-textSecondary">
                {criticalMeds.map((medication) => (
                  <li key={medication.id}>
                    {medication.name} {medication.doseAmount}
                    {medication.doseUnit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex justify-end">
            <Link to="/emergency" onClick={() => setEmergencyOpen(false)}>
              <Button variant="secondary">Open full emergency page</Button>
            </Link>
          </div>
        </div>
      </Modal>

      <Modal open={notificationsOpen} title="Notifications" onClose={() => setNotificationsOpen(false)}>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-3xl bg-brandSoft/55 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold text-textPrimary">Everything important, in one calm place.</p>
              <p className="mt-1 text-[0.95rem] leading-7 text-textSecondary">
                {unreadCount
                  ? `${unreadCount} new update${unreadCount === 1 ? "" : "s"} still need your attention.`
                  : "You are all caught up right now."}
              </p>
            </div>
            <Button variant="secondary" onClick={markAllNotificationsRead} disabled={notificationsSaving || unreadCount === 0}>
              Mark all read
            </Button>
          </div>

          <div className="grid gap-3">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={cn(
                  "rounded-3xl border p-4 text-left transition",
                  notification.isRead
                    ? "border-borderColor bg-surface hover:bg-slate-50"
                    : "border-brand/20 bg-brandSoft/35 hover:bg-brandSoft/50",
                )}
                onClick={() => {
                  if (!notification.isRead && !notificationsSaving) {
                    void markNotificationRead(notification.id);
                  }
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-textPrimary">{notification.title}</p>
                      <Badge tone={notification.isRead ? "neutral" : "brand"}>
                        {notification.isRead ? "Read" : "New"}
                      </Badge>
                      <Badge tone="warning">{sentenceCase(notification.type)}</Badge>
                    </div>
                    <p className="mt-2 text-[0.95rem] leading-7 text-textSecondary">{notification.message}</p>
                  </div>
                  <p className="shrink-0 text-[0.9rem] text-textSecondary">{relativeTime(notification.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <AnimatePresence>
        {chatOpen ? (
          <motion.div
            className="fixed inset-0 z-[9998] flex items-end justify-end bg-slate-950/25 p-0 lg:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setChatOpen(false)}
          >
            <motion.div
              drag
              dragMomentum={false}
              dragControls={dragControls}
              dragListener={false}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="relative flex h-[78vh] w-full flex-col overflow-hidden rounded-t-[16px] border border-borderColor bg-bg shadow-[0_20px_60px_rgba(0,0,0,0.15)] lg:h-[min(720px,calc(100vh-2rem))] lg:w-[min(920px,calc(100vw-2rem))] lg:rounded-[24px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className="flex min-h-[60px] cursor-move items-center justify-between border-b border-borderColor bg-gradient-to-r from-surface to-brandSoft/20 px-4 py-3"
                onPointerDown={(event) => dragControls.start(event)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brandDark shadow-sm">
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-textPrimary leading-none">CareCircle AI</p>
                    <p className="mt-0.5 text-xs text-textSecondary">For {patient.preferredName ?? patient.name} | drag to reposition</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl bg-brandSoft px-3 py-1.5 text-xs font-semibold text-brandDark transition hover:bg-brandSoft/80"
                    onClick={() => navigate("/care-chat")}
                  >
                    Full view
                  </button>
                  <button
                    type="button"
                    className="rounded-full p-2.5 text-textSecondary transition hover:bg-slate-100"
                    aria-label="Close CareCircle AI"
                    onClick={() => setChatOpen(false)}
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <CareChatAssistant compact />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
