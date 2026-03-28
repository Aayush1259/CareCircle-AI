import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, ExternalLink, PlayCircle, Send, Trash2, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import type { DisplayPreferences, FeedbackSubject, NotificationPreferences } from "@carecircle/shared";
import { Button, Card, Field, Input, Modal, SectionHeader, Select, Textarea, Toggle } from "@/components/ui";
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
    { id: "profile", label: "My Profile" },
    { id: "patient", label: "Patient Info", visible: canEditPatient },
    { id: "team", label: "Team Access", visible: canManageFamily },
    { id: "notifications", label: "Notifications" },
    { id: "security", label: "Security & Data" },
    { id: "support", label: "Help & Support" },
  ].filter((t) => t.visible !== false);

  const handleTabChange = (tabId: string) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("tab", tabId);
    setParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Horizontal Tabs */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="inline-flex space-x-2 rounded-full border border-borderColor bg-white p-1 shadow-calm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-brand text-white shadow-md"
                  : "text-textSecondary hover:bg-slate-50 hover:text-textPrimary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6">
        {activeTab === "profile" && <ProfileEditor />}
        {activeTab === "patient" && <PatientEditor />}
        {activeTab === "team" && <AccessManager />}

        {activeTab === "notifications" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionHeader
                title="Notifications"
                description="Turn on the nudges that actually help."
                action={
                  <div className="flex gap-2">
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
                  </div>
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
                  <div key={key} className="flex items-center justify-between gap-4 rounded-[28px] border border-borderColor/80 bg-white p-4 shadow-sm">
                    <div>
                      <p className="font-semibold text-textPrimary">{label}</p>
                      <p className="text-sm text-textSecondary">
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
                title="Display settings"
                description="Make the whole app easier to read at a glance."
                action={
                  <div className="flex gap-2">
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
                  </div>
                }
              />
              <div className="grid gap-5">
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
                        className={`rounded-[28px] border p-4 text-left transition ${
                          displayDraft.fontSize === value ? "border-brand bg-brandSoft shadow-sm" : "border-borderColor bg-white hover:bg-slate-50"
                        }`}
                        onClick={() =>
                          setDisplayDraft((current) => ({
                            ...current,
                            fontSize: value as DisplayPreferences["fontSize"],
                          }))
                        }
                      >
                        <p className="font-semibold text-textPrimary">{label}</p>
                        <p className="mt-1 text-sm text-textSecondary">
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
                      ["teal", "#0D9488"],
                      ["blue", "#2563EB"],
                      ["purple", "#7C3AED"],
                    ].map(([value, color]) => (
                      <button
                        key={value}
                        type="button"
                        className={`rounded-[28px] border p-4 text-left transition ${
                          displayDraft.colorTheme === value ? "border-brand bg-brandSoft shadow-sm" : "border-borderColor bg-white hover:bg-slate-50"
                        }`}
                        onClick={() =>
                          setDisplayDraft((current) => ({
                            ...current,
                            colorTheme: value as DisplayPreferences["colorTheme"],
                          }))
                        }
                      >
                        <span className="mb-3 block h-8 w-full rounded-full" style={{ backgroundColor: color }} />
                        <p className="font-semibold capitalize text-textPrimary">{value}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[28px] border border-borderColor/80 bg-white p-4 shadow-sm">
                  <div>
                    <p className="font-semibold text-textPrimary">High contrast mode</p>
                    <p className="text-sm text-textSecondary">Boost visual clarity across the whole app.</p>
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
          <Card>
            <SectionHeader
              title="Data and privacy"
              description={
                canExport || canViewAuditLog
                  ? "Export what you need and keep control of your information."
                  : "Personal account controls live here. Patient exports and security logs stay with the primary caregiver."
              }
            />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-4">
                <div className="rounded-[28px] border border-borderColor/80 bg-white p-5 shadow-sm">
                  <p className="text-base font-semibold text-textPrimary">Account security</p>
                  <p className="mt-1 text-sm text-textSecondary">
                    Send a password reset link to {bootstrap.viewer.email} if you want to rotate your password safely.
                  </p>
                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => void sendPasswordResetLink()} disabled={passwordResetSending}>
                      <ShieldAlert className="h-4 w-4" />
                      {passwordResetSending ? "Sending..." : "Email password reset link"}
                    </Button>
                  </div>
                </div>

                {canExport ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[28px] border border-borderColor/80 bg-white p-5 shadow-sm">
                      <p className="font-semibold text-textPrimary">Export workspace data</p>
                      <p className="mt-1 text-sm text-textSecondary">
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

                    <div className="rounded-[28px] border border-borderColor/80 bg-white p-5 shadow-sm">
                      <p className="font-semibold text-textPrimary">Download uploaded files</p>
                      <p className="mt-1 text-sm text-textSecondary">
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
                  <div className="rounded-[28px] border border-dashed border-borderColor p-5 text-sm text-textSecondary">
                    This role can manage its own account settings, but patient export tools are only visible to the primary caregiver.
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border border-red-200 bg-red-50 p-5">
                <p className="text-base font-semibold text-red-900">Danger zone</p>
                <p className="mt-1 text-sm text-red-900/80">
                  Remove this account from the current session and sign out of the patient workspace immediately.
                </p>
                <Button variant="danger" className="mt-4 w-full" onClick={() => setDeleteOpen(true)} disabled={deleteSaving}>
                  <Trash2 className="h-4 w-4" />
                  Delete account
                </Button>
              </div>
            </div>
            {canViewAuditLog ? (
              <div className="mt-6 rounded-3xl border border-borderColor bg-slate-50 p-4">
                <p className="text-base font-semibold text-textPrimary">Recent security activity</p>
                <div className="mt-3 space-y-3">
                  {securityAuditLogs.length === 0 ? (
                    <p className="text-sm text-textSecondary italic">No recent activity found.</p>
                  ) : (
                    securityAuditLogs.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-textPrimary">{entry.action.replaceAll("_", " ")}</p>
                          <p className="text-sm text-textSecondary">{entry.detail}</p>
                        </div>
                        <p className="shrink-0 text-xs text-textSecondary">{formatDate(entry.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </Card>
        )}

        {activeTab === "support" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionHeader title="Help and support" description="Answers and quick guides without the tech jargon." action={<Button variant="ghost" onClick={() => setFeedbackOpen(true)}>Send feedback</Button>} />
              <div className="space-y-3">
                {faqs.map(([question, answer]) => (
                  <details key={question} className="rounded-3xl border border-borderColor p-4 bg-white/50 hover:bg-white transition-colors">
                    <summary className="cursor-pointer text-base font-semibold text-textPrimary">{question}</summary>
                    <p className="mt-3 text-base text-textSecondary leading-relaxed">{answer}</p>
                  </details>
                ))}
              </div>
            </Card>

            <Card>
              <SectionHeader title="Guides and quick links" description="Short walkthroughs for the moments you need extra confidence." />
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {videoGuides.map((guide) => (
                    <div key={guide.title} className="rounded-3xl border border-borderColor p-4 bg-white/50">
                      <button
                        type="button"
                        className="flex h-32 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brandDark text-white shadow-md transition hover:opacity-95"
                        onClick={() => setVideoOpen(guide.url)}
                      >
                        <PlayCircle className="h-10 w-10 opacity-90 transition-opacity hover:opacity-100" />
                      </button>
                      <p className="mt-4 text-base font-bold text-textPrimary line-clamp-1">{guide.title}</p>
                      <p className="mt-1 text-sm text-textSecondary line-clamp-2">{guide.description}</p>
                      <Button variant="secondary" className="mt-4 w-full" onClick={() => setVideoOpen(guide.url)}>
                        Watch guide
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="rounded-[28px] border border-borderColor/80 bg-slate-50/80 p-5">
                  <p className="text-base font-semibold text-textPrimary">Quick help links</p>
                  <div className="mt-4 grid gap-3">
                    {currentSettings.helpLinks.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-2xl border border-borderColor bg-white px-4 py-3 text-sm font-semibold text-textPrimary transition hover:bg-slate-50"
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
      </div>

      <Modal open={Boolean(videoOpen)} title="Guide preview" onClose={() => setVideoOpen(null)}>
        {videoOpen ? (
          <div className="space-y-4">
            <div className="aspect-video overflow-hidden rounded-3xl border border-borderColor">
              <iframe title="CareCircle guide placeholder" src={videoOpen} className="h-full w-full" allowFullScreen />
            </div>
            <a href={videoOpen} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-base font-semibold text-brandDark hover:underline">
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
            <p className="mt-2 text-sm text-textSecondary">{feedbackForm.message.length} / {feedbackMinLength} characters minimum</p>
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
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-900">This action cannot be undone</p>
                <p className="mt-1 text-sm text-red-800">
                  This signs you out and removes this session's account data. You will lose access to the patient record immediately.
                </p>
              </div>
            </div>
          </div>
          <p className="text-base font-semibold text-textPrimary">Type DELETE to confirm.</p>
          <Input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder="DELETE" />
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleteSaving}>Cancel</Button>
            <Button variant="danger" disabled={deleteText !== "DELETE" || deleteSaving} onClick={deleteAccount}>
              {deleteSaving ? "Deleting..." : "Delete Account"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
