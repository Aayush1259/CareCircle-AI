import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, ExternalLink, PlayCircle, Send, Trash2, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import type { FeedbackSubject } from "@carecircle/shared";
import { Button, Card, Field, Input, Modal, SectionHeader, Select, Textarea, Toggle } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { apiBase } from "@/lib/api";
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

export const SettingsPage = () => {
  const { bootstrap, request, refresh, logout } = useAppData();
  const [params, setParams] = useSearchParams();
  const [videoOpen, setVideoOpen] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [feedbackForm, setFeedbackForm] = useState(initialFeedback);
  const [savedToggleKey, setSavedToggleKey] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);

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
        params.delete("confirmEmail");
        setParams(params);
        await refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "We could not confirm that email.");
      }
    })();
  }, [params, request, refresh, setParams]);

  useEffect(() => {
    if ((activeTab === "team" && !canManageFamily) || (activeTab === "patient" && !canEditPatient)) {
      setParams({ tab: "profile" }, { replace: true });
    }
  }, [activeTab, canEditPatient, canManageFamily, setParams]);

  if (!bootstrap || !currentSettings) return null;

  const updateNotification = async (key: string, value: unknown) => {
    try {
      await request("/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      setSavedToggleKey(key);
      window.setTimeout(() => setSavedToggleKey(""), 1500);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const updateDisplay = async (patch: Record<string, unknown>) => {
    try {
      await request("/settings/display", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      toast.success("Display updated.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
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
    try {
      await request("/settings/account", { method: "DELETE" });
      toast.success("Your account was removed from this session.");
      await logout();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
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
    setParams({ tab: tabId }, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Horizontal Tabs */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="inline-flex space-x-2 rounded-full border border-borderColor bg-white p-1 shadow-calm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
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
              <SectionHeader title="Notifications" description="Turn on the nudges that actually help." />
              <div className="space-y-4">
                {[
                  ["Medication reminders", "medicationReminders"],
                  ["24-hour appointment reminders", "appointment24h"],
                  ["1-hour appointment reminders", "appointment1h"],
                  ["Weekly family summary email", "weeklySummary"],
                  ["AI insight alerts", "aiInsightAlerts"],
                  ["Family activity updates", "familyActivityUpdates"],
                ].map(([label, key]) => (
                  <div key={key} className="flex items-center justify-between rounded-3xl border border-borderColor p-4">
                    <div>
                      <p className="font-semibold text-textPrimary">{label}</p>
                      <p className="text-sm text-textSecondary">{savedToggleKey === key ? "Saved" : "You can change this any time."}</p>
                    </div>
                    <Toggle
                      checked={Boolean(bootstrap.viewer.notificationPreferences[key as keyof typeof bootstrap.viewer.notificationPreferences])}
                      onChange={(value) => void updateNotification(key, value)}
                      aria-label={label}
                    />
                  </div>
                ))}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Reminder time">
                    <Input type="time" value={bootstrap.viewer.notificationPreferences.medicationReminderTime} onChange={(event) => void updateNotification("medicationReminderTime", event.target.value)} />
                  </Field>
                  <Field label="Weekly summary day">
                    <Select value={bootstrap.viewer.notificationPreferences.weeklySummaryDay} onChange={(event) => void updateNotification("weeklySummaryDay", event.target.value)}>
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader title="Display settings" description="Make the whole app easier to read at a glance." />
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
                        className={`rounded-3xl border p-4 text-left ${currentSettings.display.fontSize === value ? "border-brand bg-brandSoft" : "border-borderColor bg-white hover:bg-slate-50"}`}
                        onClick={() => void updateDisplay({ fontSize: value })}
                      >
                        <p className="font-semibold text-textPrimary">{label}</p>
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
                        className={`rounded-3xl border p-4 text-left ${currentSettings.display.colorTheme === value ? "border-brand bg-brandSoft" : "border-borderColor bg-white hover:bg-slate-50"}`}
                        onClick={() => void updateDisplay({ colorTheme: value })}
                      >
                        <span className="mb-3 block h-8 w-full rounded-2xl" style={{ backgroundColor: color }} />
                        <p className="font-semibold capitalize text-textPrimary">{value}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-3xl border border-borderColor p-4">
                  <div>
                    <p className="font-semibold text-textPrimary">High contrast mode</p>
                    <p className="text-sm text-textSecondary">Boost visual clarity across the whole app.</p>
                  </div>
                  <Toggle checked={currentSettings.display.highContrast} onChange={(value) => void updateDisplay({ highContrast: value })} aria-label="High contrast mode" />
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
            <div className="grid gap-4 lg:grid-cols-3">
              {canExport ? (
                <>
                  <Button
                    title="Download a CSV export of the patient workspace."
                    onClick={() => window.open(`${apiBase}/settings/export/csv`, "_blank", "noopener,noreferrer")}
                  >
                    <Download className="h-4 w-4" />
                    Export My Data
                  </Button>
                  <Button
                    variant="secondary"
                    title="Download a ZIP of patient documents."
                    onClick={() => window.open(`${apiBase}/settings/export/documents.zip`, "_blank", "noopener,noreferrer")}
                  >
                    <Download className="h-4 w-4" />
                    Download All Documents
                  </Button>
                </>
              ) : (
                <div className="rounded-3xl border border-dashed border-borderColor p-4 text-sm text-textSecondary lg:col-span-2">
                  This role can manage its own account settings, but patient export tools are only visible to the primary caregiver.
                </div>
              )}
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete Account
              </Button>
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
              <SectionHeader title="Help and support" description="Answers and quick guides without the tech jargon." action={<Button variant="ghost" onClick={() => setFeedbackOpen(true)}>Send Feedback</Button>} />
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
              <SectionHeader title="Video guides" description="Short walkthroughs for the moments you need extra confidence." />
              <div className="grid gap-4 sm:grid-cols-2">
                {videoGuides.map((guide) => (
                  <div key={guide.title} className="rounded-3xl border border-borderColor p-4 bg-white/50">
                    <div className="flex h-32 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brandDark text-white shadow-md">
                      <PlayCircle className="h-10 w-10 opacity-90 transition-opacity hover:opacity-100 cursor-pointer" onClick={() => setVideoOpen(guide.url)} />
                    </div>
                    <p className="mt-4 text-base font-bold text-textPrimary line-clamp-1">{guide.title}</p>
                    <p className="mt-1 text-sm text-textSecondary line-clamp-2">{guide.description}</p>
                    <Button variant="secondary" className="mt-4 w-full" onClick={() => setVideoOpen(guide.url)}>
                      Watch Guide
                    </Button>
                  </div>
                ))}
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
            <p className="mt-2 text-sm text-textSecondary">{feedbackForm.message.length} / 100 characters minimum</p>
          </Field>
          <Field label="Reply email (optional)">
            <Input type="email" value={feedbackForm.replyEmail} onChange={(event) => setFeedbackForm((current) => ({ ...current, replyEmail: event.target.value }))} placeholder="you@example.com" />
          </Field>
          <Button disabled={feedbackSaving || trimmedText(feedbackForm.message).length < 100} onClick={submitFeedback}>
            <Send className="h-4 w-4" />
            {feedbackSaving ? "Sending..." : "Send Feedback"}
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
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={deleteText !== "DELETE"} onClick={deleteAccount}>Delete Account</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
