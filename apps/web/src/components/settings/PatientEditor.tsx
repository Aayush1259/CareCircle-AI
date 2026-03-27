import { useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, Field, Input, SectionHeader, Select } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { hasText, trimmedText } from "@/lib/validation";

const phonePattern = /^\+1 \d{3}-\d{3}-\d{4}$/;

const commonConditions = [
  "Type 2 Diabetes", "Hypertension", "Alzheimer's Disease", "Arthritis", "Heart Failure", "COPD", "Asthma", "Osteoporosis",
  "Parkinson's Disease", "Chronic Kidney Disease", "Depression", "Anxiety", "Stroke", "Atrial Fibrillation", "High Cholesterol",
  "Coronary Artery Disease", "Dementia", "Early-stage Alzheimer's", "Neuropathy", "Macular Degeneration", "Glaucoma", "Sleep Apnea",
  "Hypothyroidism", "Hyperthyroidism", "Anemia", "Chronic Pain", "Migraines", "GERD", "IBS", "Constipation", "Urinary Incontinence",
  "Osteoarthritis", "Rheumatoid Arthritis", "Peripheral Artery Disease", "Obesity", "Cancer", "Liver Disease", "Epilepsy",
  "Seizure Disorder", "Fibromyalgia", "Balance Issues", "Hearing Loss", "Vision Loss", "Insomnia", "Anxiety Disorder",
  "Bipolar Disorder", "Post-surgical Recovery", "Fall Risk", "Frailty", "Memory Loss", "Diabetic Retinopathy", "Chronic Wounds",
];

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

export const PatientEditor = () => {
  const { bootstrap, request, refresh } = useAppData();

  const [patientProfile, setPatientProfile] = useState(() => ({
    name: bootstrap?.patient?.name ?? "",
    dateOfBirth: bootstrap?.patient?.dateOfBirth ?? "",
    photoUrl: bootstrap?.patient?.photoUrl ?? "",
    primaryDiagnosis: bootstrap?.patient?.primaryDiagnosis ?? "",
    secondaryConditions: bootstrap?.patient?.secondaryConditions ?? [],
    primaryDoctorName: bootstrap?.patient?.primaryDoctorName ?? "",
    primaryDoctorPhone: bootstrap?.patient?.primaryDoctorPhone ? formatPhoneInput(bootstrap.patient.primaryDoctorPhone) : "",
    hospitalPreference: bootstrap?.patient?.hospitalPreference ?? "",
    insuranceProvider: bootstrap?.patient?.insuranceProvider ?? "",
    insuranceId: bootstrap?.patient?.insuranceId ?? "",
    bloodType: bootstrap?.patient?.bloodType ?? "",
    allergies: bootstrap?.patient?.allergies ?? [],
    mobilityLevel: bootstrap?.patient?.mobilityLevel ?? "",
  }));

  const [conditionDraft, setConditionDraft] = useState("");
  const [allergyDraft, setAllergyDraft] = useState("");
  const [patientErrors, setPatientErrors] = useState<Record<string, string>>({});
  const [patientSaving, setPatientSaving] = useState(false);

  const canEditPatient = bootstrap?.capabilities.includes("edit_patient") ?? false;

  if (!bootstrap) return null;

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

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await request<{ fileUrl: string }>("/uploads/image", {
        method: "POST",
        body: formData,
      });
      setPatientProfile((current) => ({ ...current, photoUrl: result.fileUrl }));
      toast.success("Photo uploaded.");
    } catch {
      toast.error("Failed to upload photo. Please try again.");
    }
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

  if (!canEditPatient) {
    return (
      <Card>
        <SectionHeader title="Patient profile access" description="Patient-level editing stays with the primary caregiver." />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">This account cannot edit patient details.</p>
          <p className="mt-2 text-sm text-amber-900/80">
            Demographics, insurance, and emergency profile changes are limited to the primary caregiver so the care record stays consistent.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Patient profile" description="Everything responders, doctors, and family members need in one place." />
      <div className="grid gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <label className="flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-borderColor bg-brandSoft text-brandDark">
            {patientProfile.photoUrl ? (
              <img src={patientProfile.photoUrl} alt="Patient profile" className="h-full w-full object-cover" />
            ) : (
              <UploadCloud className="h-8 w-8" />
            )}
            <input className="hidden" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0])} />
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
  );
};
