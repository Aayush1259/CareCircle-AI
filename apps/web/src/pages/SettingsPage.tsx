import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, ExternalLink, PlayCircle, Send, Trash2, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import type { FeedbackSubject } from "@carecircle/shared";
import { Badge, Button, Card, Field, Input, Modal, SectionHeader, Select, Textarea, Toggle } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";
import { hasText, trimmedText } from "@/lib/validation";

const commonConditions = [
  "Type 2 Diabetes", "Hypertension", "Alzheimer's Disease", "Arthritis", "Heart Failure", "COPD", "Asthma", "Osteoporosis",
  "Parkinson's Disease", "Chronic Kidney Disease", "Depression", "Anxiety", "Stroke", "Atrial Fibrillation", "High Cholesterol",
  "Coronary Artery Disease", "Dementia", "Early-stage Alzheimer's", "Neuropathy", "Macular Degeneration", "Glaucoma", "Sleep Apnea",
  "Hypothyroidism", "Hyperthyroidism", "Anemia", "Chronic Pain", "Migraines", "GERD", "IBS", "Constipation", "Urinary Incontinence",
  "Osteoarthritis", "Rheumatoid Arthritis", "Peripheral Artery Disease", "Obesity", "Cancer", "Liver Disease", "Epilepsy",
  "Seizure Disorder", "Fibromyalgia", "Balance Issues", "Hearing Loss", "Vision Loss", "Insomnia", "Anxiety Disorder",
  "Bipolar Disorder", "Post-surgical Recovery", "Fall Risk", "Frailty", "Memory Loss", "Diabetic Retinopathy", "Chronic Wounds",
];

const videoGuides = [
  { title: "Dashboard basics", description: "See what matters today in one glance.", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
  { title: "Medication tracking", description: "Log, refill, and check medications simply.", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
  { title: "Care journal", description: "Capture symptoms and changes in plain language.", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
  { title: "Documents", description: "Upload paperwork and get plain-English summaries.", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
  { title: "Emergency tools", description: "Find the most important information in one tap.", url: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
];

const faqs = [
  ["How do I add a new medication?", "Open Medications, tap Add Medication, and save the name, dose, and schedule."],
  ["How do I invite a family member?", "Go to Family Hub or Settings, choose Invite Member, enter their details, and send the invite email."],
  ["What does the AI pattern analysis do?", "It reviews recent notes or readings, looks for trends, and explains what may be worth watching."],
  ["How do I upload a medical document?", "Open Documents, choose the file, pick a category, and tap Upload and Analyze."],
  ["How do I generate an emergency protocol?", "Open Emergency and use Regenerate with AI or Regenerate all protocols."],
  ["Can I manage more than one patient?", "The data model supports it, but this demo keeps one patient active so things stay simple."],
  ["How do I change notification times?", "Open Settings, go to Notifications, and update the reminder toggles, time, or weekly summary day."],
  ["Is my data private and secure?", "Private files stay in protected storage and access follows patient-based permissions when Supabase is configured."],
  ["How do I export my data?", "Use Export My Data for a CSV or Download All Documents for a ZIP of uploaded files."],
  ["What do I do if I find incorrect AI information?", "Please tell your doctor for medical decisions and send us feedback so we can review the response quickly."],
] as const;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+1 \d{3}-\d{3}-\d{4}$/;

const initialFeedback = {
  subject: "bug_report" as FeedbackSubject,
  message: "",
  replyEmail: "",
};

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const normalized = digits.startsWith("1") ? digits : `1${digits}`;
  const core = normalized.slice(1);
  const area = core.slice(0, 3);
  const middle = core.slice(3, 6);
  const end = core.slice(6, 10);
  if (!area) return "+1 ";
  if (!middle) return `+1 ${area}`;
  if (!end) return `+1 ${area}-${middle}`;
  return `+1 ${area}-${middle}-${end}`;
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
  const [profileSaving, setProfileSaving] = useState(false);
  const [patientSaving, setPatientSaving] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const currentSettings = bootstrap?.data.settings.find((item) => item.userId === bootstrap.viewer.id);

  const [profile, setProfile] = useState(() => ({
    name: bootstrap?.viewer.name ?? "",
    email: bootstrap?.viewer.email ?? "",
    phone: bootstrap?.viewer.phone ? formatPhoneInput(bootstrap.viewer.phone) : "",
    photoUrl: bootstrap?.viewer.photoUrl ?? "",
  }));

  const [patientProfile, setPatientProfile] = useState(() => ({
    name: bootstrap?.patient.name ?? "",
    dateOfBirth: bootstrap?.patient.dateOfBirth ?? "",
    photoUrl: bootstrap?.patient.photoUrl ?? "",
    primaryDiagnosis: bootstrap?.patient.primaryDiagnosis ?? "",
    secondaryConditions: bootstrap?.patient.secondaryConditions ?? [],
    primaryDoctorName: bootstrap?.patient.primaryDoctorName ?? "",
    primaryDoctorPhone: bootstrap?.patient.primaryDoctorPhone ? formatPhoneInput(bootstrap.patient.primaryDoctorPhone) : "",
    hospitalPreference: bootstrap?.patient.hospitalPreference ?? "",
    insuranceProvider: bootstrap?.patient.insuranceProvider ?? "",
    insuranceId: bootstrap?.patient.insuranceId ?? "",
    bloodType: bootstrap?.patient.bloodType ?? "",
    allergies: bootstrap?.patient.allergies ?? [],
    mobilityLevel: bootstrap?.patient.mobilityLevel ?? "",
  }));

  const [conditionDraft, setConditionDraft] = useState("");
  const [allergyDraft, setAllergyDraft] = useState("");
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [patientErrors, setPatientErrors] = useState<Record<string, string>>({});

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

  if (!bootstrap || !currentSettings) return null;

  const profileDirty = useMemo(
    () =>
      profile.name !== bootstrap.viewer.name ||
      profile.email !== bootstrap.viewer.email ||
      trimmedText(profile.phone) !== trimmedText(bootstrap.viewer.phone ? formatPhoneInput(bootstrap.viewer.phone) : "") ||
      profile.photoUrl !== (bootstrap.viewer.photoUrl ?? ""),
    [bootstrap.viewer, profile],
  );

  const patientDirty = useMemo(
    () => JSON.stringify(patientProfile) !== JSON.stringify({
      name: bootstrap.patient.name,
      dateOfBirth: bootstrap.patient.dateOfBirth,
      photoUrl: bootstrap.patient.photoUrl ?? "",
      primaryDiagnosis: bootstrap.patient.primaryDiagnosis,
      secondaryConditions: bootstrap.patient.secondaryConditions,
      primaryDoctorName: bootstrap.patient.primaryDoctorName,
      primaryDoctorPhone: bootstrap.patient.primaryDoctorPhone ? formatPhoneInput(bootstrap.patient.primaryDoctorPhone) : "",
      hospitalPreference: bootstrap.patient.hospitalPreference,
      insuranceProvider: bootstrap.patient.insuranceProvider,
      insuranceId: bootstrap.patient.insuranceId,
      bloodType: bootstrap.patient.bloodType,
      allergies: bootstrap.patient.allergies,
      mobilityLevel: bootstrap.patient.mobilityLevel,
    }),
    [bootstrap.patient, patientProfile],
  );

  const uploadImage = async (file: File, target: "profile" | "patient") => {
    const formData = new FormData();
    formData.append("file", file);
    const result = await request<{ fileUrl: string }>("/uploads/image", {
      method: "POST",
      body: formData,
    });
    if (target === "profile") setProfile((current) => ({ ...current, photoUrl: result.fileUrl }));
    if (target === "patient") setPatientProfile((current) => ({ ...current, photoUrl: result.fileUrl }));
    toast.success("Photo uploaded.");
  };

  const validateProfile = () => {
    const nextErrors: Record<string, string> = {};
    if (!hasText(profile.name)) nextErrors.name = "Please enter your name.";
    if (!emailPattern.test(trimmedText(profile.email))) nextErrors.email = "Please enter a valid email address.";
    if (hasText(profile.phone) && !phonePattern.test(trimmedText(profile.phone))) nextErrors.phone = "Use the format +1 555-123-4567.";
    setProfileErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validatePatient = () => {
    const nextErrors: Record<string, string> = {};
    if (!hasText(patientProfile.name)) nextErrors.name = "Please enter your loved one's name.";
    if (!hasText(patientProfile.dateOfBirth)) nextErrors.dateOfBirth = "Please enter a birth date.";
    if (hasText(patientProfile.primaryDoctorPhone) && !phonePattern.test(trimmedText(patientProfile.primaryDoctorPhone))) {
      nextErrors.primaryDoctorPhone = "Use the format +1 555-123-4567.";
    }
    setPatientErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveProfile = async () => {
    if (!validateProfile()) return;
    setProfileSaving(true);
    try {
      await request("/settings/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: trimmedText(profile.name),
          phone: trimmedText(profile.phone),
          photoUrl: trimmedText(profile.photoUrl),
        }),
      });

      if (trimmedText(profile.email).toLowerCase() !== bootstrap.viewer.email.toLowerCase()) {
        await request("/settings/profile/email-change/request", {
          method: "POST",
          body: JSON.stringify({ email: trimmedText(profile.email).toLowerCase() }),
        });
        toast.success("We emailed a confirmation link for the new address.");
      } else {
        toast.success("Profile saved!");
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  const savePatient = async () => {
    if (!validatePatient()) return;
    setPatientSaving(true);
    try {
      await request("/settings/patient", {
        method: "PUT",
        body: JSON.stringify({
          ...patientProfile,
          primaryDoctorPhone: trimmedText(patientProfile.primaryDoctorPhone),
        }),
      });
      toast.success("Patient profile saved!");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setPatientSaving(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Profile" description="Keep your contact details and photo up to date." />
          <div className="grid gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <label className="flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-borderColor bg-brandSoft text-brandDark">
                {profile.photoUrl ? <img src={profile.photoUrl} alt="Caregiver profile" className="h-full w-full object-cover" /> : <UploadCloud className="h-8 w-8" />}
                <input className="hidden" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0], "profile")} />
              </label>
              <div>
                <p className="text-base font-semibold text-textPrimary">Your photo</p>
                <p className="text-sm text-textSecondary">Tap the circle to upload a new image.</p>
              </div>
            </div>
            <Field label="Full name">
              <Input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} className={profileErrors.name ? "border-danger" : ""} />
              {profileErrors.name ? <p className="mt-2 text-sm text-danger">{profileErrors.name}</p> : null}
            </Field>
            <Field label="Email">
              <Input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} className={profileErrors.email ? "border-danger" : ""} />
              {profileErrors.email ? <p className="mt-2 text-sm text-danger">{profileErrors.email}</p> : null}
            </Field>
            <Field label="Phone">
              <Input value={profile.phone} placeholder="+1 555-123-4567" onChange={(event) => setProfile((current) => ({ ...current, phone: formatPhoneInput(event.target.value) }))} className={profileErrors.phone ? "border-danger" : ""} />
              {profileErrors.phone ? <p className="mt-2 text-sm text-danger">{profileErrors.phone}</p> : null}
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-textSecondary">Last updated {currentSettings.updatedAt ? formatDate(currentSettings.updatedAt) : "today"}</p>
              <Button disabled={!profileDirty || profileSaving} onClick={saveProfile}>
                {profileSaving ? "Saving profile..." : "Save Profile"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Patient profile" description="Everything responders, doctors, and family members need in one place." />
          <div className="grid gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <label className="flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-borderColor bg-brandSoft text-brandDark">
                {patientProfile.photoUrl ? <img src={patientProfile.photoUrl} alt="Patient profile" className="h-full w-full object-cover" /> : <UploadCloud className="h-8 w-8" />}
                <input className="hidden" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0], "patient")} />
              </label>
              <div>
                <p className="text-base font-semibold text-textPrimary">Patient photo</p>
                <p className="text-sm text-textSecondary">Tap to upload or replace the current photo.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input value={patientProfile.name} onChange={(event) => setPatientProfile((current) => ({ ...current, name: event.target.value }))} className={patientErrors.name ? "border-danger" : ""} />
                {patientErrors.name ? <p className="mt-2 text-sm text-danger">{patientErrors.name}</p> : null}
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={patientProfile.dateOfBirth} onChange={(event) => setPatientProfile((current) => ({ ...current, dateOfBirth: event.target.value }))} className={patientErrors.dateOfBirth ? "border-danger" : ""} />
                {patientErrors.dateOfBirth ? <p className="mt-2 text-sm text-danger">{patientErrors.dateOfBirth}</p> : null}
              </Field>
            </div>
            <Field label="Main condition">
              <Input list="condition-options" value={patientProfile.primaryDiagnosis} onChange={(event) => setPatientProfile((current) => ({ ...current, primaryDiagnosis: event.target.value }))} placeholder="Type to search or add your own" />
              <datalist id="condition-options">
                {commonConditions.map((condition) => <option key={condition} value={condition} />)}
              </datalist>
            </Field>
            <Field label="Other conditions">
              <div className="flex flex-wrap gap-2 rounded-3xl border border-borderColor p-3">
                {patientProfile.secondaryConditions.map((condition) => (
                  <button
                    key={condition}
                    type="button"
                    className="rounded-full bg-brandSoft px-3 py-2 text-sm font-semibold text-brandDark"
                    onClick={() => setPatientProfile((current) => ({ ...current, secondaryConditions: current.secondaryConditions.filter((item) => item !== condition) }))}
                  >
                    {condition} x
                  </button>
                ))}
                <input
                  list="condition-options"
                  className="min-w-0 flex-1 border-0 p-2 text-base outline-none"
                  placeholder="Add another condition"
                  value={conditionDraft}
                  onChange={(event) => setConditionDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && hasText(conditionDraft)) {
                      event.preventDefault();
                      setPatientProfile((current) => ({
                        ...current,
                        secondaryConditions: Array.from(new Set([...current.secondaryConditions, trimmedText(conditionDraft)])),
                      }));
                      setConditionDraft("");
                    }
                  }}
                />
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Doctor name">
                <Input value={patientProfile.primaryDoctorName} onChange={(event) => setPatientProfile((current) => ({ ...current, primaryDoctorName: event.target.value }))} />
              </Field>
              <Field label="Doctor phone">
                <Input value={patientProfile.primaryDoctorPhone} placeholder="+1 555-123-4567" onChange={(event) => setPatientProfile((current) => ({ ...current, primaryDoctorPhone: formatPhoneInput(event.target.value) }))} className={patientErrors.primaryDoctorPhone ? "border-danger" : ""} />
                {patientErrors.primaryDoctorPhone ? <p className="mt-2 text-sm text-danger">{patientErrors.primaryDoctorPhone}</p> : null}
              </Field>
              <Field label="Hospital preference">
                <Input value={patientProfile.hospitalPreference} onChange={(event) => setPatientProfile((current) => ({ ...current, hospitalPreference: event.target.value }))} />
              </Field>
              <Field label="Mobility level">
                <Input value={patientProfile.mobilityLevel} onChange={(event) => setPatientProfile((current) => ({ ...current, mobilityLevel: event.target.value }))} />
              </Field>
              <Field label="Insurance provider">
                <Input value={patientProfile.insuranceProvider} onChange={(event) => setPatientProfile((current) => ({ ...current, insuranceProvider: event.target.value }))} />
              </Field>
              <Field label="Insurance ID">
                <Input value={patientProfile.insuranceId} onChange={(event) => setPatientProfile((current) => ({ ...current, insuranceId: event.target.value }))} />
              </Field>
              <Field label="Blood type">
                <Select value={patientProfile.bloodType} onChange={(event) => setPatientProfile((current) => ({ ...current, bloodType: event.target.value }))}>
                  <option value="">Choose one</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bloodType) => (
                    <option key={bloodType} value={bloodType}>{bloodType}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Allergies">
              <div className="flex flex-wrap gap-2 rounded-3xl border border-borderColor p-3">
                {patientProfile.allergies.map((allergy) => (
                  <button
                    key={allergy}
                    type="button"
                    className="rounded-full bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                    onClick={() => setPatientProfile((current) => ({ ...current, allergies: current.allergies.filter((item) => item !== allergy) }))}
                  >
                    {allergy} x
                  </button>
                ))}
                <input
                  className="min-w-0 flex-1 border-0 p-2 text-base outline-none"
                  placeholder="Type an allergy and press Enter"
                  value={allergyDraft}
                  onChange={(event) => setAllergyDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && hasText(allergyDraft)) {
                      event.preventDefault();
                      setPatientProfile((current) => ({
                        ...current,
                        allergies: Array.from(new Set([...current.allergies, trimmedText(allergyDraft)])),
                      }));
                      setAllergyDraft("");
                    }
                  }}
                />
              </div>
            </Field>
            <div className="flex justify-end">
              <Button disabled={!patientDirty || patientSaving} onClick={savePatient}>
                {patientSaving ? "Saving patient..." : "Save Patient"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
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
                    className={`rounded-3xl border p-4 text-left ${currentSettings.display.fontSize === value ? "border-brand bg-brandSoft" : "border-borderColor bg-white"}`}
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
                    className={`rounded-3xl border p-4 text-left ${currentSettings.display.colorTheme === value ? "border-brand bg-brandSoft" : "border-borderColor bg-white"}`}
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Help and support" description="Answers and quick guides without the tech jargon." action={<Button variant="ghost" onClick={() => setFeedbackOpen(true)}>Send Feedback</Button>} />
          <div className="space-y-3">
            {faqs.map(([question, answer]) => (
              <details key={question} className="rounded-3xl border border-borderColor p-4">
                <summary className="cursor-pointer text-base font-semibold text-textPrimary">{question}</summary>
                <p className="mt-3 text-base text-textSecondary">{answer}</p>
              </details>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Video guides" description="Short walkthroughs for the moments you need extra confidence." />
          <div className="grid gap-4 sm:grid-cols-2">
            {videoGuides.map((guide) => (
              <div key={guide.title} className="rounded-3xl border border-borderColor p-4">
                <div className="flex h-32 items-center justify-center rounded-3xl bg-gradient-to-br from-brand to-brandDark text-white">
                  <PlayCircle className="h-10 w-10" />
                </div>
                <p className="mt-4 text-lg font-bold text-textPrimary">{guide.title}</p>
                <p className="mt-1 text-sm text-textSecondary">{guide.description}</p>
                <Button variant="secondary" className="mt-4 w-full" onClick={() => setVideoOpen(guide.url)}>
                  Watch Guide
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Data and privacy" description="Export what you need and keep control of your information." />
        <div className="grid gap-4 lg:grid-cols-3">
          <Button onClick={() => window.open("/api/settings/export/csv", "_blank", "noopener,noreferrer")}>
            <Download className="h-4 w-4" />
            Export My Data
          </Button>
          <Button variant="secondary" onClick={() => window.open("/api/settings/export/documents.zip", "_blank", "noopener,noreferrer")}>
            <Download className="h-4 w-4" />
            Download All Documents
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </div>
      </Card>

      <Modal open={Boolean(videoOpen)} title="Guide preview" onClose={() => setVideoOpen(null)}>
        {videoOpen ? (
          <div className="space-y-4">
            <div className="aspect-video overflow-hidden rounded-3xl border border-borderColor">
              <iframe title="CareCircle guide placeholder" src={videoOpen} className="h-full w-full" allowFullScreen />
            </div>
            <a href={videoOpen} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-base font-semibold text-brandDark">
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
            <Textarea value={feedbackForm.message} onChange={(event) => setFeedbackForm((current) => ({ ...current, message: event.target.value }))} />
            <p className="mt-2 text-sm text-textSecondary">{feedbackForm.message.length} / 100 characters minimum</p>
          </Field>
          <Field label="Reply email (optional)">
            <Input type="email" value={feedbackForm.replyEmail} onChange={(event) => setFeedbackForm((current) => ({ ...current, replyEmail: event.target.value }))} />
          </Field>
          <Button disabled={feedbackSaving || trimmedText(feedbackForm.message).length < 100} onClick={submitFeedback}>
            <Send className="h-4 w-4" />
            {feedbackSaving ? "Sending..." : "Send Feedback"}
          </Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} title="Delete account" onClose={() => setDeleteOpen(false)}>
        <div className="grid gap-4">
          <p className="text-base text-textSecondary">Type DELETE to confirm. This signs you out and removes this session's account data.</p>
          <Input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder="DELETE" />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={deleteText !== "DELETE"} onClick={deleteAccount}>Delete account</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
