import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  MessageCircle,
  MoreHorizontal,
  Pill,
  ShieldAlert,
  Users as UsersIcon,
  X,
  Sparkles,
  ChevronRight
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
  { to: "/family", label: "Family Hub", shortLabel: "Family", icon: UsersIcon, requiredCapability: "view_family" },
  { to: "/tasks", label: "Tasks", shortLabel: "Tasks", icon: ClipboardCheck, requiredCapability: "view_tasks" },
  { to: "/emergency", label: "Emergency", shortLabel: "SOS", icon: ShieldAlert, requiredCapability: "view_emergency" },
];

const familyNavigation: NavigationItem[] = [
  { to: "/family-home", label: "Home", shortLabel: "Home", icon: Home },
  { to: "/medications", label: "Medications", shortLabel: "Meds", icon: Pill, requiredCapability: "view_medications" },
  { to: "/tasks", label: "My Tasks", shortLabel: "Tasks", icon: ClipboardCheck, requiredCapability: "view_tasks" },
  { to: "/family", label: "Family Chat", shortLabel: "Family", icon: UsersIcon, requiredCapability: "view_family" },
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const blockedPathRef = useRef<string | null>(null);

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
  const moreNavigation = useMemo(() => navigation.slice(mobilePrimaryTabs.length), [mobilePrimaryTabs.length, navigation]);
  const allowedPaths = useMemo(() => roleAllowedPaths(viewerRole, capabilities), [capabilities, viewerRole]);
  const canManageFamily = capabilities.includes("manage_family");
  const canViewInsurance = capabilities.includes("view_insurance");
  const canViewAuditLog = capabilities.includes("view_audit_log");

  const openSettingsSection = (section: "profile" | "preferences" | "privacy" | "access") => {
    const nextTab =
      section === "preferences"
        ? "notifications"
        : section === "privacy"
          ? "security"
          : section === "access"
            ? (canManageFamily ? "team" : "security")
            : "profile";
    navigate(`/settings?tab=${nextTab}`);
    setProfileOpen(false);
  };

  useEffect(() => {
    if (!bootstrap) return;
    if (location.pathname.startsWith("/care-chat")) {
      setChatOpen(true);
      navigate(roleHomePath(viewerRole), { replace: true });
    }
  }, [bootstrap, location.pathname, navigate, viewerRole]);

  useEffect(() => {
    if (!bootstrap) return;
    const isAllowed = allowedPaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
    if (!isAllowed && location.pathname !== "/") {
      if (blockedPathRef.current !== location.pathname) {
        blockedPathRef.current = location.pathname;
        toast.error("That section isn't available for this role.", {
          id: `role-blocked:${location.pathname}`,
        });
      }
      navigate(roleHomePath(viewerRole), { replace: true });
      return;
    }
    blockedPathRef.current = null;
  }, [allowedPaths, bootstrap, location.pathname, navigate, viewerRole]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [profileOpen]);

  const pageTitle = useMemo(
    () => {
      if (location.pathname.startsWith("/settings")) return "Settings";
      return navigation.find((item) => location.pathname.startsWith(item.to))?.label ?? "Care Hub";
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
  const patientLabel = `${patient.preferredName ?? patient.name} • ${calcAge(patient.dateOfBirth)}Y`;
  const activeMedicationCount = bootstrap.data.medications.filter((item) => item.isActive).length;
  const upcomingAppointmentCount = bootstrap.data.appointments.filter((item) => item.status === "upcoming").length;
  const primaryDoctorCallHref = patient.primaryDoctorPhone
    ? `tel:${patient.primaryDoctorPhone.replaceAll(/[^0-9]/g, "")}`
    : "/settings";
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
    <div className="min-h-screen min-h-[100svh] overflow-x-hidden bg-bg text-textPrimary selection:bg-brand/10 selection:text-brand">
      <aside className="sidebar-scroll fixed left-0 top-0 hidden h-screen min-h-screen min-h-[100svh] w-[296px] overflow-y-auto border-r border-slate-100/90 bg-white/68 px-5 py-7 backdrop-blur-2xl lg:flex lg:flex-col">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand via-brand/90 to-brandDark p-6 text-white shadow-premium"
        >
          <div className="relative z-10">
            <div className="mb-4 flex items-center gap-2.5 text-white/82">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.9rem] border border-white/14 bg-white/12 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.5)] backdrop-blur-lg">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="truncate font-['Outfit'] text-[0.66rem] font-bold uppercase tracking-[0.28em] text-white/76">
                CareCircle AI
              </p>
            </div>
            <h1 className="font-['Outfit'] text-[1.55rem] font-bold leading-tight tracking-tight">Calm care, <br/> every day.</h1>
            <p className="mt-4 max-w-[14rem] text-[0.82rem] leading-6 text-white/78">
              Medication, appointments, documents, and family coordination in one professional workspace.
            </p>
            <div className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/10 px-3.5 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-white/90 backdrop-blur-md">
              {roleTitle}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-md">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-white/60">Unread</p>
                <p className="mt-2 font-['Outfit'] text-xl font-bold">{unreadCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-md">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-white/60">Insights</p>
                <p className="mt-2 font-['Outfit'] text-xl font-bold">{activeInsights.length}</p>
              </div>
            </div>
          </div>
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-brandDark/20 blur-2xl" />
        </motion.div>

        <nav aria-label="Primary navigation" className="mt-8 flex-1 space-y-1">
          {navigation.map(({ to, label, icon: Icon }, idx) => (
            <motion.div
              key={to}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + idx * 0.03 }}
            >
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    "group flex min-h-[48px] items-center gap-3 rounded-[1.2rem] px-3.5 py-2.5 text-[0.85rem] font-bold tracking-tight transition-all duration-300 focus:outline-none",
                    isActive
                      ? "bg-brandSoft/90 text-brandDark shadow-[0_14px_28px_-18px_rgba(79,70,229,0.55)] ring-1 ring-brand/5"
                      : "text-textSecondary hover:bg-white hover:text-brand hover:shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]",
                  )
                }
              >
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300",
                  "sm:h-10 sm:w-10",
                  location.pathname.startsWith(to) ? "bg-white text-brand shadow-sm scale-105" : "bg-slate-100/50 text-textSecondary group-hover:bg-brandSoft/60 group-hover:text-brand"
                )}>
                  <Icon className="h-[1.125rem] w-[1.125rem]" />
                </div>
                <span className="truncate">{label}</span>
                {location.pathname.startsWith(to) && (
                  <motion.div layoutId="nav-indicator" className="ml-auto">
                    <ChevronRight className="h-4 w-4 opacity-30" />
                  </motion.div>
                )}
              </NavLink>
            </motion.div>
          ))}
        </nav>

        <div className="mt-auto pt-8">
          <div className="group rounded-[1.7rem] border border-white/80 bg-white/76 p-5 shadow-premium backdrop-blur-2xl transition-all hover:bg-white cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-[1.1rem] bg-brandSoft text-brand text-base font-bold shadow-inner">
                  {patient.preferredName?.[0] ?? patient.name?.[0]}
                </div>
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-4 border-white bg-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-['Outfit'] font-bold text-textPrimary">{patient.preferredName ?? patient.name}</p>
                <p className="truncate text-[0.68rem] font-bold uppercase tracking-[0.2em] text-textSecondary/70">
                  {patient.primaryDiagnosis}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: "Age", value: `${calcAge(patient.dateOfBirth)}` },
                { label: "Meds", value: `${activeMedicationCount}` },
                { label: "Visits", value: `${upcomingAppointmentCount}` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50/90 px-3 py-3 text-center ring-1 ring-slate-100">
                  <p className="text-[0.58rem] font-bold uppercase tracking-[0.22em] text-textSecondary/70">{item.label}</p>
                <p className="mt-1 font-['Outfit'] text-base font-bold text-textPrimary">{item.value}</p>
                </div>
              ))}
            </div>
              <div className="mt-4 flex items-center justify-between rounded-[1.2rem] border border-slate-100 bg-slate-50/75 px-4 py-3">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-textSecondary/70">Lead Clinician</p>
                <p className="mt-1 text-[0.85rem] font-semibold text-textPrimary">{patient.primaryDoctorName}</p>
              </div>
              <Badge tone="brand" className="rounded-xl px-3 py-1 text-[0.62rem]">Active</Badge>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 overflow-x-hidden lg:pl-[296px]">
        <header className="sticky top-0 z-40 border-b border-slate-100 bg-bg/85 backdrop-blur-2xl">
          <div className="mx-auto flex w-full max-w-[1380px] min-w-0 items-center gap-2.5 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4 xl:px-8">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                <p className="font-['Outfit'] text-[0.65rem] font-bold uppercase tracking-[0.25em] text-brand/70 leading-none">{pageTitle}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2.5 sm:mt-2.5 sm:gap-4">
                <h2 className="min-w-0 flex-1 truncate font-['Outfit'] text-[1.18rem] font-bold tracking-tight text-textPrimary sm:text-[1.55rem]">
                  {headerTitle}
                </h2>
                <div className="hidden h-5 w-[1px] bg-slate-200 lg:block" />
                <div className="hidden items-center gap-2 lg:flex">
                  <span className="rounded-xl bg-slate-100/80 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-textSecondary border border-slate-50">{patientLabel}</span>
                  <Badge tone="brand" className="rounded-xl px-3 py-1 text-[0.62rem]">{roleTitle}</Badge>
                  {unreadCount > 0 ? <Badge tone="neutral" className="rounded-xl px-3 py-1 text-[0.62rem]">{unreadCount} unread</Badge> : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Button variant="danger" className="hidden xl:inline-flex h-10 rounded-xl px-4 py-2 shadow-lg shadow-red-100/50" onClick={() => setEmergencyOpen(true)}>
                <ShieldAlert className="h-4 w-4" />
                Emergency
              </Button>

              <button
                type="button"
                className="group relative rounded-[1.15rem] border border-slate-100 bg-white p-3 shadow-sm transition hover:bg-slate-50 hover:border-slate-200 sm:rounded-2xl sm:p-3.5"
                aria-label="Open notifications"
                onClick={() => setNotificationsOpen(true)}
              >
                <Bell className="h-[1.15rem] w-[1.15rem] text-textPrimary transition-transform group-hover:rotate-12 sm:h-5 sm:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 text-[9px] font-bold text-white shadow-brand/20 shadow-lg">
                    {unreadCount}
                  </span>
                )}
              </button>

              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  className="flex min-h-[46px] items-center gap-2 rounded-[1.15rem] border border-slate-100 bg-white px-3 py-1.5 shadow-sm transition hover:bg-slate-50 sm:min-h-[48px] sm:gap-2.5 sm:rounded-2xl sm:px-3.5 sm:py-2"
                  onClick={() => setProfileOpen((current) => !current)}
                  aria-label="Open profile menu"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-[0.95rem] bg-brandSoft text-brandDark font-['Outfit'] font-bold shadow-inner sm:h-9 sm:w-9 sm:rounded-xl">
                    {bootstrap.viewer.name[0]}
                  </div>
                  <ChevronDown className={cn("hidden h-4 w-4 text-textSecondary transition-transform duration-300 sm:block", profileOpen ? "rotate-180" : "")} />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 top-[calc(100%+0.8rem)] z-50 w-64 rounded-[2rem] border border-slate-100 bg-white p-3 shadow-premium"
                    >
                      <button type="button" className="w-full rounded-2xl px-4 py-3.5 text-left text-sm font-bold text-textPrimary hover:bg-slate-50 transition-colors" onClick={() => openSettingsSection("profile")}>
                        My Profile
                      </button>
                      <button type="button" className="w-full rounded-2xl px-4 py-3.5 text-left text-sm font-bold text-textPrimary hover:bg-slate-50 transition-colors" onClick={() => openSettingsSection("preferences")}>
                        App Preferences
                      </button>
                      <button type="button" className="w-full rounded-2xl px-4 py-3.5 text-left text-sm font-bold text-textPrimary hover:bg-slate-50 transition-colors" onClick={() => openSettingsSection("privacy")}>
                        Privacy & Access
                      </button>
                      <div className="my-2 h-[1px] bg-slate-50 mx-2" />
                      <button
                        type="button"
                        className="w-full rounded-2xl px-4 py-3.5 text-left text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => { setProfileOpen(false); void logout(); }}
                      >
                        Log Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

          <main role="main" className="mx-auto w-full max-w-[1280px] min-w-0 flex-1 px-4 py-6 pb-[calc(7.7rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-8 sm:pb-[calc(8.2rem+env(safe-area-inset-bottom))] xl:px-8 lg:pb-12">
            <Outlet />
          </main>
      </div>

      <nav className="pointer-events-none fixed inset-x-0 z-40 px-3 pt-3 lg:hidden" style={{ bottom: "max(0.65rem, env(safe-area-inset-bottom))" }}>
        <div
          className="pointer-events-auto mx-auto grid max-w-[24rem] gap-1 rounded-[1.45rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.82))] p-1 shadow-[0_28px_55px_-24px_rgba(15,23,42,0.34)] ring-1 ring-white/75 backdrop-blur-2xl sm:max-w-[27rem] sm:gap-1.5 sm:rounded-[1.7rem] sm:p-1.5"
          style={{ gridTemplateColumns: `repeat(${mobilePrimaryTabs.length + 1}, minmax(0, 1fr))` }}
        >
          {mobilePrimaryTabs.map(({ to, shortLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[2.8rem] min-w-0 flex-col items-center justify-center rounded-[1rem] px-1 py-1.5 text-[0.52rem] font-bold uppercase tracking-[0.14em] transition-all duration-300 sm:min-h-[3.1rem] sm:rounded-[1.2rem] sm:text-[0.58rem] sm:tracking-[0.16em]",
                  isActive ? "bg-brand text-white shadow-brand/20 shadow-lg" : "text-textSecondary hover:bg-slate-50",
                )
              }
            >
              <Icon className="mb-0.5 h-[0.95rem] w-[0.95rem] sm:mb-1 sm:h-4 sm:w-4" />
              <span className="max-w-full truncate">{shortLabel}</span>
            </NavLink>
          ))}
          <button
            type="button"
            className="flex min-h-[2.8rem] min-w-0 flex-col items-center justify-center rounded-[1rem] px-1 py-1.5 text-[0.52rem] font-bold uppercase tracking-[0.14em] text-textSecondary hover:bg-slate-50 sm:min-h-[3.1rem] sm:rounded-[1.2rem] sm:text-[0.58rem] sm:tracking-[0.16em]"
            onClick={() => setMoreOpen(true)}
          >
            <MoreHorizontal className="mb-0.5 h-[0.95rem] w-[0.95rem] sm:mb-1 sm:h-4 sm:w-4" />
            <span className="max-w-full truncate">More</span>
          </button>
        </div>
      </nav>

      <motion.button
        type="button"
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        whileHover={{ scale: 1.1, rotate: -5 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-[9999] flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-brand to-brandDark text-white shadow-[0_18px_40px_-12px_rgba(99,102,241,0.58)] transition-shadow hover:shadow-[0_24px_50px_-14px_rgba(99,102,241,0.68)] sm:right-5 sm:bottom-[calc(6.5rem+env(safe-area-inset-bottom))] sm:h-14 sm:w-14 sm:rounded-[1.35rem] lg:bottom-8 lg:right-8"
        onClick={() => setChatOpen(true)}
      >
        <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
        {chatBadgeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white border-4 border-white">
            {chatBadgeCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {chatOpen && (
          <div className="fixed inset-0 z-[10000] flex items-end justify-center p-2.5 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
              onClick={() => setChatOpen(false)}
            />
            <motion.div
              drag
              dragMomentum={false}
              dragControls={dragControls}
              dragListener={false}
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative flex h-[min(88svh,52rem)] max-h-[calc(100svh-0.4rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-2xl sm:max-h-[calc(100svh-2rem)] sm:rounded-[2.5rem] lg:rounded-[3rem]"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex min-h-[4.25rem] items-center justify-between gap-3 border-b border-slate-50 bg-slate-50/50 px-4 py-3 sm:h-20 sm:px-8 sm:cursor-move"
                onPointerDown={(event) => {
                  if (window.innerWidth >= 640) {
                    dragControls.start(event);
                  }
                }}
              >
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1.1rem] bg-brand text-white shadow-lg sm:h-10 sm:w-10 sm:rounded-2xl">
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-['Outfit'] text-lg font-bold text-textPrimary sm:text-xl">CareCircle AI</h3>
                    <p className="hidden truncate text-[10px] font-bold uppercase tracking-widest text-textSecondary opacity-60 sm:block">
                      Deep Intelligence Hub • Drag to Move
                    </p>
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-textSecondary opacity-60 sm:hidden">
                      Quick care support
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <Button variant="ghost" className="hidden h-10 rounded-xl px-4 text-xs sm:inline-flex sm:px-6" onClick={() => navigate("/care-chat")}>Full Experience</Button>
                  <button onClick={() => setChatOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3.5 scrollbar-thin sm:p-8">
                <CareChatAssistant compact />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Modal open={moreOpen} title="More" onClose={() => setMoreOpen(false)} className="sm:max-w-xl">
        <div className="space-y-5">
          {moreNavigation.length ? (
            <div className="grid gap-2">
              {moreNavigation.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className="os-shell-soft flex items-center gap-3 px-4 py-4 text-sm font-bold tracking-tight text-textPrimary transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brandSoft text-brandDark">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <ChevronRight className="h-4 w-4 text-textSecondary/60" />
                </Link>
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="os-shell-soft px-4 py-4 text-left"
              onClick={() => {
                setMoreOpen(false);
                navigate("/settings");
              }}
            >
              <p className="font-semibold text-textPrimary">Open settings</p>
              <p className="mt-1 text-sm text-textSecondary">Profile, notifications, privacy, and access</p>
            </button>
            <button
              type="button"
              className="os-shell-soft px-4 py-4 text-left"
              onClick={() => {
                setMoreOpen(false);
                setNotificationsOpen(true);
              }}
            >
              <p className="font-semibold text-textPrimary">Open notifications</p>
              <p className="mt-1 text-sm text-textSecondary">{unreadCount ? `${unreadCount} unread messages` : "View recent alerts and reminders"}</p>
            </button>
            <button
              type="button"
              className="os-shell-soft px-4 py-4 text-left"
              onClick={() => {
                setMoreOpen(false);
                setEmergencyOpen(true);
              }}
            >
              <p className="font-semibold text-textPrimary">Emergency tools</p>
              <p className="mt-1 text-sm text-textSecondary">Get to the highest-priority help fast</p>
            </button>
          </div>

          <div className="section-well bg-brandSoft/45">
            <p className="font-semibold text-textPrimary">Workspace status</p>
            <p className="mt-2 text-sm leading-6 text-textSecondary">
              {activeInsights.length ? `${activeInsights.length} AI insights are waiting for review.` : "AI insight queue is quiet right now."}
            </p>
            <p className="mt-1 text-sm leading-6 text-textSecondary">
              {canViewInsurance ? "Insurance details are available from the emergency workspace." : "Emergency and care essentials stay available from here."}
            </p>
          </div>
        </div>
      </Modal>

      <Modal open={notificationsOpen} title="Notifications" onClose={() => setNotificationsOpen(false)} className="sm:max-w-2xl">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-[1.7rem] bg-brandSoft/35 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-textPrimary">{unreadCount ? `${unreadCount} unread updates` : "All caught up"}</p>
              <p className="mt-1 text-sm text-textSecondary">Medication reminders, appointments, task nudges, and family activity appear here.</p>
            </div>
            <Button variant="secondary" disabled={!unreadCount || notificationsSaving} onClick={() => void markAllNotificationsRead()}>
              {notificationsSaving ? "Updating..." : "Mark all read"}
            </Button>
          </div>

          <div className="space-y-3">
            {notifications.length ? (
              notifications.map((notification) => (
                <div key={notification.id} className={cn("os-shell-soft px-4 py-4", notification.isRead ? "opacity-80" : "")}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="glass-chip">
                          {sentenceCase(notification.type.replaceAll("_", " "))}
                        </span>
                        {!notification.isRead ? <Badge tone="brand">New</Badge> : null}
                      </div>
                      <p className="mt-3 font-['Outfit'] text-lg font-bold text-textPrimary">{notification.title}</p>
                      <p className="mt-2 text-sm leading-6 text-textSecondary">{notification.message}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-textSecondary/70">
                        {relativeTime(notification.createdAt)}
                      </p>
                      {!notification.isRead ? (
                        <Button
                          variant="ghost"
                          className="min-h-[42px] px-4 text-xs"
                          disabled={notificationsSaving}
                          onClick={() => void markNotificationRead(notification.id)}
                        >
                          Mark read
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="section-well text-center">
                <p className="font-semibold text-textPrimary">No notifications yet</p>
                <p className="mt-2 text-sm text-textSecondary">Alerts and reminders will surface here automatically.</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={emergencyOpen} title="Emergency Quick Access" onClose={() => setEmergencyOpen(false)} className="sm:max-w-xl">
        <div className="space-y-4">
          <div className="hero-shell p-5 sm:p-6">
            <div className="relative z-10">
              <div className="glass-chip w-fit text-white/85">High priority</div>
              <p className="mt-4 font-['Outfit'] text-[1.45rem] font-bold sm:text-2xl">The fastest route to urgent care information.</p>
              <p className="mt-2 text-[0.85rem] leading-6 text-white/78 sm:text-sm">
                Use these actions to call for help, reach the doctor, or open the full emergency workspace.
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            <a
              href="tel:911"
              className="inline-flex min-h-[48px] items-center justify-center rounded-[1.2rem] bg-red-500 px-4 py-3 text-[0.92rem] font-bold text-white shadow-[0_20px_38px_-20px_rgba(239,68,68,0.82)] sm:min-h-[56px] sm:rounded-[1.45rem] sm:px-5 sm:text-base"
            >
              <ShieldAlert className="mr-2 h-5 w-5" />
              Call 911
            </a>
            <a
              href={primaryDoctorCallHref}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[1.2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.7))] px-4 py-3 text-[0.92rem] font-bold text-textPrimary shadow-[0_18px_34px_-24px_rgba(15,23,42,0.24)] sm:min-h-[56px] sm:rounded-[1.45rem] sm:px-5 sm:text-base"
            >
              <Bell className="mr-2 h-5 w-5 text-brandDark" />
              Call Dr. {patient.primaryDoctorName.replace("Dr. ", "")}
            </a>
            <Link
              to="/emergency"
              onClick={() => setEmergencyOpen(false)}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[1.2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.6))] px-4 py-3 text-[0.92rem] font-bold text-brandDark shadow-[0_18px_34px_-24px_rgba(15,23,42,0.24)] sm:min-h-[56px] sm:rounded-[1.45rem] sm:px-5 sm:text-base"
            >
              <ShieldAlert className="mr-2 h-5 w-5" />
              Open full emergency center
            </Link>
          </div>
          <div className="section-well">
            <p className="font-semibold text-textPrimary">Patient snapshot</p>
            <p className="mt-2 text-sm text-textSecondary">
              {patient.preferredName ?? patient.name} · {patient.primaryDiagnosis}
            </p>
            <p className="mt-1 text-sm text-textSecondary">
              {canViewAuditLog ? "Security activity and audit controls remain available from Settings." : "Use Settings for profile, access, and notification controls."}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
