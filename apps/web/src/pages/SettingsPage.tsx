import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Download, ExternalLink, PlayCircle, Send, Trash2, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import type { DisplayPreferences, FeedbackSubject, NotificationPreferences } from "@carecircle/shared";
import { Button, Card, Field, Input, Modal, SectionHeader, Select, Textarea, Toggle, cn } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { apiFileRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { trimmedText } from "@/lib/validation";

import { ProfileEditor } from "@/components/settings/ProfileEditor";
import { PatientEditor } from "@/components/settings/PatientEditor";
import { AccessManager } from "@/components/settings/AccessManager";

const videoGuides = [
  { title: "Dashboard basics", description: "See what matters today in one glance.", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
  { title: "Medication tracking", description: "Log, refill, and check medications simply.", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
  { title: "Care journal", description: "Capture symptoms and changes in plain language.", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
  { title: "Documents", description: "Upload paperwork and get plain-English summaries.", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
  { title: "Emergency tools", description: "Find the most important information in one tap.", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
];

const faqs = [
  ["How do I add a new medication?", "Open Medications, tap Add Medication, and save the name, dose, and schedule."],
  ["How do I invite a family member?", "Go to Family Hub or open the avatar menu, choose Invite Member, enter their details, and send the invite email."],
  ["What does the AI pattern analysis do?", "It reviews recent notes or readings, looks for trends, and explains what may be worth watching."],
  ["How do I upload a medical document?", "Open Documents, choose the file, pick a category, and tap Upload and Analyze."],
  ["How do I generate an emergency protocol?", "Open Emergency and use Regenerate with AI or Regenerate all protocols."],
  ["Can I manage more than one patient?", "The data model supports it, but this demo keeps one patient active so things stay simple."],
  ["How do I change notification times?", "Open the avatar menu, go to Notifications, and update the reminder toggles, time, or weekly summary day."],
  ["Is my data private and secure?", "Private files stay in protected storage and access follows patient-based permissions when Supabase is configured."],
  ["How do I export my data?", "Use Export My Data for a CSV or Download All Documents for a ZIP of uploaded files."],
  ["What do I do if I find incorrect AI information?", "Please tell your doctor for medical decisions and send us feedback so we can review the response quickly."],
] as const;

const initialFeedback = {
  subject: "bug_report" as FeedbackSubject,
  message: "",
  replyEmail: "",
};

const feedbackMinLength = 30;
const defaultNotificationPreferences: NotificationPreferences = {
  medicationReminders: true,
  medicationReminderTime: "08:00",
  appointment24h: true,
  appointment1h: true,
  weeklySummary: true,
  weeklySummaryDay: "Sunday",
  aiInsightAlerts: true,
  familyActivityUpdates: true,
  timezone: "America/Los_Angeles",
};
const defaultDisplayPreferences: DisplayPreferences = {
  fontSize: "normal",
  colorTheme: "teal",
  dashboardLayout: "detailed",
  highContrast: false,
};
const mobileTabLabels: Record<string, string> = {
  profile: "Profile",
  patient: "Patient",
  team: "Team",
  notifications: "Alerts",
  security: "Privacy",
  support: "Help",
};

export const SettingsPage = () => {
  const { bootstrap, request, refresh, logout, requestPasswordReset } = useAppData();
  const [params, setParams] = useSearchParams();
  const [videoOpen, setVideoOpen] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [feedbackForm, setFeedbackForm] = useState(initialFeedback);
  const [notificationDraft, setNotificationDraft] = useState<NotificationPreferences>(() => bootstrap?.viewer.notificationPreferences ?? defaultNotificationPreferences);
  const [displayDraft, setDisplayDraft] = useState<DisplayPreferences>(
    () => bootstrap?.data.settings.find((item) => item.userId === bootstrap.viewer.id)?.display ?? defaultDisplayPreferences,
  );
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [displaySaving, setDisplaySaving] = useState(false);
  const [exportingKey, setExportingKey] = useState("");
  const [passwordResetSending, setPasswordResetSending] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const blockedTabRef = useRef<string | null>(null);

  // Tabbed layout state
  const activeTab = params.get("tab") || "profile";

  const currentSettings = bootstrap?.data.settings.find((item) => item.userId === bootstrap.viewer.id);
  const canEditPatient = bootstrap?.capabilities.includes("edit_patient") ?? false;
  const canExport = bootstrap?.capabilities.includes("export_data") ?? false;
  const canViewAuditLog = bootstrap?.capabilities.includes("view_audit_log") ?? false;
  const securityAuditLogs = bootstrap?.data.securityAuditLogs.slice(0, 6) ?? [];
  const canManageFamily = bootstrap?.capabilities.includes("manage_family") ?? false;

  useEffect(() => {
    const token = params.get("confirmEmail");
    if (!token) return;
    void (async () => {
      try {
        await request("/settings/profile/email-change/confirm", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        toast.success("Your email address is confirmed.");
        const nextParams = new URLSearchParams(params);
        nextParams.delete("confirmEmail");
        setParams(nextParams, { replace: true });
        await refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "We could not confirm that email.");
      }
    })();
  }, [params, request, refresh, setParams]);

  useEffect(() => {
    if ((activeTab === "team" && !canManageFamily) || (activeTab === "patient" && !canEditPatient)) {
      if (blockedTabRef.current !== activeTab) {
        blockedTabRef.current = activeTab;
        toast.error("That settings section isn't available for this role.");
      }
      setParams({ tab: "profile" }, { replace: true });
      return;
    }
    blockedTabRef.current = null;
  }, [activeTab, canEditPatient, canManageFamily, setParams]);

  useEffect(() => {
    if (!bootstrap) return;
    setNotificationDraft(bootstrap.viewer.notificationPreferences);
  }, [bootstrap?.viewer.id]);

  useEffect(() => {
    if (!currentSettings) return;
    setDisplayDraft(currentSettings.display);
  }, [currentSettings?.userId]);

  useEffect(() => {
    if (activeTab !== "notifications") return undefined;
    const root = document.documentElement;
    const previousTheme = root.dataset.theme;
    const previousFontScale = root.dataset.fontScale;
    const previousContrast = root.dataset.contrast;

    root.dataset.theme = displayDraft.colorTheme;
    root.dataset.fontScale = displayDraft.fontSize;
    root.dataset.contrast = displayDraft.highContrast ? "high" : "normal";

    return () => {
      root.dataset.theme = previousTheme ?? currentSettings?.display.colorTheme ?? "teal";
      root.dataset.fontScale = previousFontScale ?? currentSettings?.display.fontSize ?? "normal";
      root.dataset.contrast = previousContrast ?? (currentSettings?.display.highContrast ? "high" : "normal");
    };
  }, [activeTab, currentSettings?.display.colorTheme, currentSettings?.display.fontSize, currentSettings?.display.highContrast, displayDraft]);

  if (!bootstrap || !currentSettings) return null;

  const notificationDirty = JSON.stringify(notificationDraft) !== JSON.stringify(bootstrap.viewer.notificationPreferences);
  const displayDirty = JSON.stringify(displayDraft) !== JSON.stringify(currentSettings.display);

  const saveNotifications = async () => {
    setNotificationSaving(true);
    try {
      await request("/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify(notificationDraft),
      });
      toast.success("Notification settings saved.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setNotificationSaving(false);
    }
  };

  const saveDisplay = async () => {
    setDisplaySaving(true);
    try {
      await request("/settings/display", {
        method: "PATCH",
        body: JSON.stringify(displayDraft),
      });
      toast.success("Display updated.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setDisplaySaving(false);
    }
  };

  const downloadExport = async (path: string, fallbackFileName: string, key: string) => {
    setExportingKey(key);
    try {
      const { blob, fileName } = await apiFileRequest(path);
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName ?? fallbackFileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      toast.success("Download started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed. Please try again.");
    } finally {
      setExportingKey("");
    }
  };

  const sendPasswordResetLink = async () => {
    setPasswordResetSending(true);
    try {
      const result = await requestPasswordReset(bootstrap.viewer.email);
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not send the reset email.");
    } finally {
      setPasswordResetSending(false);
    }
  };

  const submitFeedback = async () => {
    setFeedbackSaving(true);
    try {
      await request("/settings/feedback", {
        method: "POST",
        body: JSON.stringify(feedbackForm),
      });
      toast.success("Thank you! We'll review your feedback within 48 hours.");
      setFeedbackForm(initialFeedback);
      setFeedbackOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send - please try again.");
    } finally {
      setFeedbackSaving(false);
    }
  };

  const deleteAccount = async () => {
    setDeleteSaving(true);
    try {
      await request("/settings/account", { method: "DELETE" });
      toast.success("Your account was removed from this session.");
      await logout();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setDeleteSaving(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "patient", label: "Patient" , visible: canEditPatient },
    { id: "team", label: "Team", visible: canManageFamily },
    { id: "notifications", label: "Alerts" },
    { id: "security", label: "Privacy" },
    { id: "support", label: "Help" },
  ].filter((t) => t.visible !== false);

  const handleTabChange = (tabId: string) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("tab", tabId);
    setParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <Card className="hero-shell hero-card-pad border-none text-white shadow-premium">
        <div className="absolute -right-16 top-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 left-0 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative z-10 max-w-3xl">
          <div className="glass-chip w-fit text-white/88">Settings</div>
          <h1 className="hero-headline mt-4 text-balance">
            Manage your CareCircle workspace.
          </h1>
          <p className="hero-body-copy mt-3 max-w-2xl text-white/80">
            Profile, alerts, privacy, and support stay organized in one clean control center.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/70">
            <span>Role-based access</span>
            <span className="text-white/35">•</span>
            <span>{canExport ? "Export tools available" : "Standard account tools"}</span>
            <span className="text-white/35">•</span>
            <span>{canViewAuditLog ? `${securityAuditLogs.length} recent audit items` : "Private audit controls"}</span>
          </div>
        </div>
      </Card>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="os-shell inline-flex min-w-full gap-1.5 p-1.5 sm:min-w-0 sm:gap-2 sm:p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "min-h-[42px] rounded-[1.1rem] px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] transition-all sm:min-h-[46px] sm:rounded-[1.35rem] sm:px-5 sm:py-2.5 sm:text-sm sm:normal-case sm:tracking-normal",
                activeTab === tab.id
                  ? "bg-gradient-to-br from-brand to-brandDark text-white shadow-[0_18px_34px_-18px_rgba(79,70,229,0.72)]"
                  : "text-textSecondary hover:bg-white/70 hover:text-textPrimary",
              )}
            >
              <span className="sm:hidden">{mobileTabLabels[tab.id] ?? tab.label}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="grid gap-5 sm:gap-6"
        >
          {activeTab === "profile" && <ProfileEditor />}
          {activeTab === "patient" && <PatientEditor />}
          {activeTab === "team" && <AccessManager />}

          {activeTab === "notifications" && (
            <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <Card className="mesh-card">
              <SectionHeader
                title="Alert Preferences"
                description="Turn on the nudges that help without creating noise."
                action={
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => setNotificationDraft(bootstrap.viewer.notificationPreferences)}
                      disabled={!notificationDirty || notificationSaving}
                    >
                      Reset
                    </Button>
                    <Button onClick={() => void saveNotifications()} disabled={!notificationDirty || notificationSaving}>
                      {notificationSaving ? "Saving..." : "Save changes"}
                    </Button>
                  </>
                }
              />
              <div className="space-y-4">
                {[
                  ["Medication reminders", "medicationReminders"],
                  ["24-hour appointment reminders", "appointment24h"],
                  ["1-hour appointment reminders", "appointment1h"],
                  ["Weekly family summary email", "weeklySummary"],
                  ["AI insight alerts", "aiInsightAlerts"],
                  ["Family activity updates", "familyActivityUpdates"],
                ].map(([label, key]) => (
                  <div key={key} className="os-shell-soft flex items-center justify-between gap-3 px-3.5 py-3.5 sm:gap-4 sm:px-4 sm:py-4">
                    <div className="min-w-0">
                      <p className="text-[0.92rem] font-semibold leading-6 text-textPrimary sm:text-base">{label}</p>
                      <p className="mt-1 text-[0.82rem] text-textSecondary sm:text-sm">
                        {notificationDraft[key as keyof NotificationPreferences] ? "Enabled" : "Off"}
                      </p>
                    </div>
                    <Toggle
                      checked={Boolean(notificationDraft[key as keyof NotificationPreferences])}
                      onChange={(value) =>
                        setNotificationDraft((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                      disabled={notificationSaving}
                      aria-label={label}
                    />
                  </div>
                ))}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Reminder time" hint="Used when medication reminders are turned on.">
                    <Input
                      type="time"
                      value={notificationDraft.medicationReminderTime}
                      disabled={notificationSaving || !notificationDraft.medicationReminders}
                      onChange={(event) =>
                        setNotificationDraft((current) => ({
                          ...current,
                          medicationReminderTime: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Weekly summary day">
                    <Select
                      value={notificationDraft.weeklySummaryDay}
                      disabled={notificationSaving || !notificationDraft.weeklySummary}
                      onChange={(event) =>
                        setNotificationDraft((current) => ({
                          ...current,
                          weeklySummaryDay: event.target.value,
                        }))
                      }
                    >
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Display And Readability"
                description="Preview typography and color choices before you save them."
                action={
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => setDisplayDraft(currentSettings.display)}
                      disabled={!displayDirty || displaySaving}
                    >
                      Reset
                    </Button>
                    <Button onClick={() => void saveDisplay()} disabled={!displayDirty || displaySaving}>
                      {displaySaving ? "Saving..." : "Apply changes"}
                    </Button>
                  </>
                }
              />
              <div className="grid gap-5">
                <div className="section-well bg-brandSoft/30 p-4 sm:p-5">
                  <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Live preview</p>
                  <p className="mt-2 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">
                    Adjust font size, theme, and contrast. The preview applies while this tab is open.
                  </p>
                </div>
                <div>
                  <p className="field-label">Font size</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["normal", "Normal"],
                      ["large", "Large"],
                      ["extra_large", "Extra Large"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={cn(
                          "os-shell-soft rounded-[1.5rem] p-3.5 text-left transition-transform hover:-translate-y-0.5 sm:rounded-[1.8rem] sm:p-4",
                          displayDraft.fontSize === value ? "border-brand/20 bg-brandSoft/60" : "",
                        )}
                        onClick={() =>
                          setDisplayDraft((current) => ({
                            ...current,
                            fontSize: value as DisplayPreferences["fontSize"],
                          }))
                        }
                      >
                        <p className="text-[0.92rem] font-semibold text-textPrimary sm:text-base">{label}</p>
                        <p className="mt-1 text-[0.82rem] text-textSecondary sm:text-sm">
                          {value === "normal" ? "Balanced" : value === "large" ? "More readable" : "Highest visibility"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="field-label">Color theme</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["teal", "Indigo", "#6366F1"],
                      ["blue", "Azure", "#2563EB"],
                      ["purple", "Violet", "#7C3AED"],
                    ].map(([value, label, color]) => (
                      <button
                        key={value}
                        type="button"
                        className={cn(
                          "os-shell-soft rounded-[1.5rem] p-3.5 text-left transition-transform hover:-translate-y-0.5 sm:rounded-[1.8rem] sm:p-4",
                          displayDraft.colorTheme === value ? "border-brand/20 bg-brandSoft/60" : "",
                        )}
                        onClick={() =>
                          setDisplayDraft((current) => ({
                            ...current,
                            colorTheme: value as DisplayPreferences["colorTheme"],
                          }))
                        }
                      >
                        <span className="mb-3 block h-7 w-full rounded-full sm:h-8" style={{ backgroundColor: color }} />
                        <p className="text-[0.92rem] font-semibold text-textPrimary sm:text-base">{label}</p>
                        <p className="mt-1 text-[0.82rem] text-textSecondary sm:text-sm">OS-inspired accent palette</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="os-shell-soft flex items-center justify-between gap-3 px-3.5 py-3.5 sm:gap-4 sm:px-4 sm:py-4">
                  <div className="min-w-0">
                    <p className="text-[0.92rem] font-semibold text-textPrimary sm:text-base">High contrast mode</p>
                    <p className="mt-1 text-[0.82rem] text-textSecondary sm:text-sm">Boost clarity across the workspace while keeping the same layout.</p>
                  </div>
                  <Toggle
                    checked={displayDraft.highContrast}
                    onChange={(value) =>
                      setDisplayDraft((current) => ({
                        ...current,
                        highContrast: value,
                      }))
                    }
                    disabled={displaySaving}
                    aria-label="High contrast mode"
                  />
                </div>
              </div>
            </Card>
            </div>
          )}

        {activeTab === "security" && (
          <Card className="mesh-card">
            <SectionHeader
              title="Privacy And Account"
              description={
                canExport || canViewAuditLog
                  ? "Export what you need, rotate credentials safely, and review recent workspace security activity."
                  : "Personal account controls live here. Patient exports and audit logs stay with the primary caregiver."
              }
            />
            <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-4">
                <div className="section-well p-4 sm:p-5">
                  <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Account security</p>
                  <p className="mt-2 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">
                    Send a password reset link to {bootstrap.viewer.email} if you want to rotate your password safely.
                  </p>
                  <Button variant="secondary" className="mt-4 w-full sm:w-auto" onClick={() => void sendPasswordResetLink()} disabled={passwordResetSending}>
                    <ShieldAlert className="h-4 w-4" />
                    {passwordResetSending ? "Sending..." : "Email password reset link"}
                  </Button>
                </div>

                {canExport ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="os-shell-soft px-4 py-4 sm:px-5 sm:py-5">
                      <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Export workspace data</p>
                      <p className="mt-2 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">
                        Download appointments, tasks, and journal entries as a CSV snapshot.
                      </p>
                      <Button
                        className="mt-4 w-full"
                        onClick={() => void downloadExport("/settings/export/csv", `CareCircle_Export_${new Date().toISOString().slice(0, 10)}.csv`, "csv")}
                        disabled={exportingKey.length > 0}
                      >
                        <Download className="h-4 w-4" />
                        {exportingKey === "csv" ? "Preparing..." : "Export my data"}
                      </Button>
                    </div>

                    <div className="os-shell-soft px-4 py-4 sm:px-5 sm:py-5">
                      <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Download uploaded files</p>
                      <p className="mt-2 text-[0.85rem] leading-6 text-textSecondary sm:text-sm">
                        Save a ZIP archive of the documents currently attached to this patient workspace.
                      </p>
                      <Button
                        variant="secondary"
                        className="mt-4 w-full"
                        onClick={() =>
                          void downloadExport(
                            "/settings/export/documents.zip",
                            `CareCircle_Documents_${new Date().toISOString().slice(0, 10)}.zip`,
                            "documents",
                          )
                        }
                        disabled={exportingKey.length > 0}
                      >
                        <Download className="h-4 w-4" />
                        {exportingKey === "documents" ? "Preparing..." : "Download all documents"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="section-well border-dashed">
                    <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Export access is limited for this role</p>
                    <p className="mt-2 text-[0.85rem] text-textSecondary sm:text-sm">
                      Patient export tools are only visible to the primary caregiver, while this view keeps personal account controls available.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.7rem] border border-red-200/80 bg-[linear-gradient(180deg,rgba(254,242,242,0.95),rgba(254,226,226,0.92))] p-4 shadow-[0_20px_40px_-28px_rgba(239,68,68,0.35)] sm:rounded-[2.5rem] sm:p-5">
                  <p className="text-[0.95rem] font-semibold text-red-900 sm:text-base">Danger zone</p>
                  <p className="mt-2 text-[0.85rem] leading-6 text-red-900/80 sm:text-sm">
                    Remove this account from the current session and sign out of the patient workspace immediately.
                  </p>
                  <Button variant="danger" className="mt-4 w-full" onClick={() => setDeleteOpen(true)} disabled={deleteSaving}>
                    <Trash2 className="h-4 w-4" />
                    Delete account
                  </Button>
                </div>

                {canViewAuditLog ? (
                  <div className="section-well p-4 sm:p-5">
                    <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Recent security activity</p>
                    <div className="mt-4 space-y-3">
                      {securityAuditLogs.length === 0 ? (
                        <p className="text-[0.85rem] italic text-textSecondary sm:text-sm">No recent activity found.</p>
                      ) : (
                        securityAuditLogs.map((entry) => (
                          <div key={entry.id} className="os-shell-soft flex items-start justify-between gap-3 px-3.5 py-3.5 sm:px-4 sm:py-4">
                            <div className="min-w-0">
                              <p className="text-[0.85rem] font-semibold text-textPrimary sm:text-sm">{entry.action.replaceAll("_", " ")}</p>
                              <p className="mt-1 text-[0.82rem] text-textSecondary sm:text-sm">{entry.detail}</p>
                            </div>
                            <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-textSecondary/70">{formatDate(entry.createdAt)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        )}

        {activeTab === "support" && (
          <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <Card>
              <SectionHeader title="Help Center" description="Answers and guidance without the tech jargon." action={<Button variant="ghost" onClick={() => setFeedbackOpen(true)}>Send feedback</Button>} />
              <div className="space-y-3">
                {faqs.map(([question, answer]) => (
                  <details key={question} className="os-shell-soft px-3.5 py-3.5 transition-colors open:bg-white/85 sm:px-4 sm:py-4">
                    <summary className="cursor-pointer text-[0.95rem] font-semibold text-textPrimary sm:text-base">{question}</summary>
                    <p className="mt-3 text-[0.9rem] leading-6 text-textSecondary sm:text-base sm:leading-relaxed">{answer}</p>
                  </details>
                ))}
              </div>
            </Card>

            <Card className="mesh-card">
              <SectionHeader title="Guides And Resources" description="Short walkthroughs for the moments you need extra confidence." />
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {videoGuides.map((guide) => (
                    <div key={guide.title} className="os-shell-soft px-3.5 py-3.5 sm:px-4 sm:py-4">
                      <button
                        type="button"
                        className="flex h-28 w-full items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-brand to-brandDark text-white shadow-[0_22px_36px_-24px_rgba(79,70,229,0.72)] transition hover:opacity-95 sm:h-32 sm:rounded-[1.6rem]"
                        onClick={() => setVideoOpen(guide.url)}
                      >
                        <PlayCircle className="h-10 w-10 opacity-90 transition-opacity hover:opacity-100" />
                      </button>
                      <p className="mt-4 line-clamp-1 font-['Outfit'] text-base font-bold text-textPrimary sm:text-lg">{guide.title}</p>
                      <p className="mt-1 line-clamp-2 text-[0.85rem] text-textSecondary sm:text-sm">{guide.description}</p>
                      <Button variant="secondary" className="mt-4 w-full" onClick={() => setVideoOpen(guide.url)}>
                        Watch guide
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="section-well p-4 sm:p-5">
                  <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Quick help links</p>
                  <div className="mt-4 grid gap-3">
                    {currentSettings.helpLinks.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="os-shell-soft flex items-center justify-between px-3.5 py-3.5 text-[0.85rem] font-semibold text-textPrimary transition-transform hover:-translate-y-0.5 sm:px-4 sm:py-4 sm:text-sm"
                      >
                        <span>{link.title}</span>
                        <ExternalLink className="h-4 w-4 text-textSecondary" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

      <Modal open={Boolean(videoOpen)} title="Guide preview" onClose={() => setVideoOpen(null)}>
        {videoOpen ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[1.7rem] border border-white/70 bg-white/70 shadow-[0_20px_36px_-28px_rgba(15,23,42,0.24)]">
              <div className="aspect-video">
                <iframe title="CareCircle guide placeholder" src={videoOpen} className="h-full w-full" allowFullScreen />
              </div>
            </div>
            <a href={videoOpen} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[0.95rem] font-semibold text-brandDark hover:underline sm:text-base">
              Open in a new tab
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ) : null}
      </Modal>

      <Modal open={feedbackOpen} title="Send feedback" onClose={() => setFeedbackOpen(false)}>
        <div className="grid gap-4">
          <Field label="Subject">
            <Select value={feedbackForm.subject} onChange={(event) => setFeedbackForm((current) => ({ ...current, subject: event.target.value as FeedbackSubject }))}>
              <option value="bug_report">Bug Report</option>
              <option value="feature_request">Feature Request</option>
              <option value="general_feedback">General Feedback</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Message">
            <Textarea value={feedbackForm.message} onChange={(event) => setFeedbackForm((current) => ({ ...current, message: event.target.value }))} placeholder="Please describe what happened..." />
            <p className="mt-2 text-[0.85rem] text-textSecondary sm:text-sm">{feedbackForm.message.length} / {feedbackMinLength} characters minimum</p>
          </Field>
          <Field label="Reply email (optional)">
            <Input type="email" value={feedbackForm.replyEmail} onChange={(event) => setFeedbackForm((current) => ({ ...current, replyEmail: event.target.value }))} placeholder="you@example.com" />
          </Field>
          <Button disabled={feedbackSaving || trimmedText(feedbackForm.message).length < feedbackMinLength} onClick={submitFeedback}>
            <Send className="h-4 w-4" />
            {feedbackSaving ? "Sending..." : "Send feedback"}
          </Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} title="Delete account" onClose={() => setDeleteOpen(false)}>
        <div className="grid gap-4">
          <div className="rounded-[1.45rem] border border-red-200 bg-red-50 p-4 sm:rounded-[1.6rem]">
            <div className="flex gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-[0.85rem] font-semibold text-red-900 sm:text-sm">This action cannot be undone</p>
                <p className="mt-1 text-[0.85rem] text-red-800 sm:text-sm">
                  This signs you out and removes this session's account data. You will lose access to the patient record immediately.
                </p>
              </div>
            </div>
          </div>
          <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Type DELETE to confirm.</p>
          <Input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder="DELETE" />
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleteSaving}>Cancel</Button>
            <Button variant="danger" disabled={deleteText !== "DELETE" || deleteSaving} onClick={deleteAccount}>
              {deleteSaving ? "Deleting..." : "Delete Account"}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  </AnimatePresence>
    </div>
  );
};
