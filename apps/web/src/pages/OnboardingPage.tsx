import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, HeartHandshake, Pill, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { calcAge } from "@/lib/format";
import { roleHomePath } from "@/lib/roles";

const commonConditions = [
  "Type 2 Diabetes",
  "Hypertension",
  "Alzheimer's",
  "Arthritis",
  "Heart disease",
  "COPD",
];

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const { bootstrap, request, refresh } = useAppData();
  const [step, setStep] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "caregiver",
    patientName: "",
    dateOfBirth: "",
    conditions: [] as string[],
    doctorName: "",
    doctorPhone: "",
    medicationName: "",
    medicationDose: "",
    medicationPurpose: "",
    familyEmail: "",
  });

  useEffect(() => {
    if (!bootstrap) return;
    setForm((current) => {
      if (current.name || current.email || current.patientName) {
        return current;
      }

      const viewerRole =
        bootstrap.viewerAccess?.accessRole === "doctor" || bootstrap.viewer.role === "doctor"
          ? "doctor"
          : bootstrap.viewerAccess?.accessRole === "family_member" || bootstrap.viewer.role === "family_member"
            ? "family_member"
            : "caregiver";

      return {
        ...current,
        name: bootstrap.viewer.name,
        email: bootstrap.viewer.email,
        role: viewerRole,
        patientName: bootstrap.patient.name,
        dateOfBirth: bootstrap.patient.dateOfBirth,
        conditions: [bootstrap.patient.primaryDiagnosis, ...bootstrap.patient.secondaryConditions].filter(Boolean),
        doctorName: bootstrap.patient.primaryDoctorName,
        doctorPhone: bootstrap.patient.primaryDoctorPhone,
      };
    });
  }, [bootstrap]);

  const age = useMemo(() => calcAge(form.dateOfBirth), [form.dateOfBirth]);

  const finishOnboarding = async () => {
    try {
      await request("/onboarding", {
        method: "POST",
        body: JSON.stringify({
          account: {
            name: form.name,
            email: form.email,
            role: form.role,
          },
          patient: {
            name: form.patientName,
            dateOfBirth: form.dateOfBirth,
            conditions: form.conditions,
            doctorName: form.doctorName,
            doctorPhone: form.doctorPhone,
          },
          medication: form.medicationName
            ? {
                name: form.medicationName,
                doseAmount: form.medicationDose,
                doseUnit: "mg",
                timesOfDay: ["morning", "evening"],
                purpose: form.medicationPurpose,
                instructions: "Take with food.",
              }
            : undefined,
          familyInvite: form.familyEmail ? { email: form.familyEmail } : undefined,
        }),
      });
      await refresh();
      toast.success("Your CareCircle is ready.");
      navigate(roleHomePath(form.role as "caregiver" | "family_member" | "doctor"), { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const steps = [
    {
      title: "You're not alone. CareCircle is here to help.",
      body: (
        <div className="space-y-6">
          <p className="max-w-xl text-lg text-textSecondary">
            Set up in 3 minutes. No tech experience needed.
          </p>
          <Button className="w-full sm:w-auto" onClick={() => setStep(1)}>
            Let's Get Started
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
    {
      title: "Create your account",
      body: (
        <div className="grid gap-4">
          <Field label="Your name">
            <Input value={form.name} placeholder="Example: Sarah Martinez" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <Field label="Email address">
            <Input type="email" value={form.email} placeholder="Example: sarah@email.com" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </Field>
          <Field label="Password">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input type={passwordVisible ? "text" : "password"} value={form.password} placeholder="Create a secure password" onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
              <Button type="button" variant="ghost" onClick={() => setPasswordVisible((current) => !current)}>
                {passwordVisible ? "Hide" : "Show"}
              </Button>
            </div>
          </Field>
          <Field label="Your role">
            <Select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="caregiver">I am the main caregiver</option>
              <option value="family_member">I'm a family member helping out</option>
              <option value="doctor">I am a doctor or provider</option>
            </Select>
          </Field>
        </div>
      ),
    },
    {
      title: "Add your loved one",
      body: (
        <div className="grid gap-4">
          <Field label="Loved one's name">
            <Input value={form.patientName} placeholder="Example: Eleanor Martinez" onChange={(event) => setForm((current) => ({ ...current, patientName: event.target.value }))} />
          </Field>
          <Field label="Date of birth" hint={`Age: ${age}`}>
            <Input type="date" value={form.dateOfBirth} onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))} />
          </Field>
          <Field label="Main health conditions">
            <div className="grid gap-2 sm:grid-cols-2">
              {commonConditions.map((condition) => {
                const selected = form.conditions.includes(condition);
                return (
                  <button
                    key={condition}
                    type="button"
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${selected ? "border-brand bg-brandSoft text-brandDark" : "border-borderColor bg-white text-textPrimary"}`}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        conditions: selected
                          ? current.conditions.filter((item) => item !== condition)
                          : [...current.conditions, condition],
                      }))
                    }
                  >
                    {condition}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Primary doctor name">
            <Input value={form.doctorName} placeholder="Example: Dr. Robert Chen" onChange={(event) => setForm((current) => ({ ...current, doctorName: event.target.value }))} />
          </Field>
          <Field label="Primary doctor phone">
            <Input value={form.doctorPhone} placeholder="Example: (555) 234-5678" onChange={(event) => setForm((current) => ({ ...current, doctorPhone: event.target.value }))} />
          </Field>
        </div>
      ),
    },
    {
      title: "Add first medication",
      body: (
        <div className="grid gap-4">
          <Field label="Medication name" hint="This is optional. You can skip if you want to finish setup first.">
            <Input value={form.medicationName} placeholder="Example: Metformin" onChange={(event) => setForm((current) => ({ ...current, medicationName: event.target.value }))} />
          </Field>
          <Field label="Dose amount">
            <Input value={form.medicationDose} placeholder="Example: 500" onChange={(event) => setForm((current) => ({ ...current, medicationDose: event.target.value }))} />
          </Field>
          <Field label="Why do they take it?">
            <Input value={form.medicationPurpose} placeholder="Example: Helps with blood sugar" onChange={(event) => setForm((current) => ({ ...current, medicationPurpose: event.target.value }))} />
          </Field>
        </div>
      ),
    },
    {
      title: "Invite a family member",
      body: (
        <div className="grid gap-4">
          <Field label="Family member email" hint="Optional. They will get a simple invite link.">
            <Input value={form.familyEmail} placeholder="Example: james@email.com" onChange={(event) => setForm((current) => ({ ...current, familyEmail: event.target.value }))} />
          </Field>
        </div>
      ),
    },
    {
      title: "Your CareCircle is ready.",
      body: (
        <div className="space-y-6">
          <div className="section-well bg-brandSoft/50">
            <div className="flex items-center gap-3 text-brandDark">
              <CheckCircle2 className="h-8 w-8" />
              <div>
                <p className="text-lg font-bold">Here's what to do first:</p>
                <p className="text-sm text-brandDark/80">You can do these in any order.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                { icon: Pill, title: "Check today's medications" },
                { icon: HeartHandshake, title: "Write one quick care note" },
                { icon: UserPlus, title: "Invite one more helper if needed" },
              ].map(({ icon: Icon, title }) => (
                <div key={title} className="flex items-center gap-3 rounded-2xl bg-white/80 p-4">
                  <Icon className="h-5 w-5 text-brandDark" />
                  <span className="font-semibold text-textPrimary">{title}</span>
                </div>
              ))}
            </div>
          </div>
          <Button className="w-full sm:w-auto" onClick={finishOnboarding}>
            Open my CareCircle
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen min-h-[100svh] bg-transparent px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-8">
        <Card className="hero-shell hero-card-pad relative overflow-hidden border-none text-white shadow-premium lg:sticky lg:top-28 lg:self-start lg:rounded-[2.5rem]">
          <div className="absolute -right-24 -top-16 h-72 w-72 rounded-full bg-white/10 blur-[85px]" />
          <div className="absolute -bottom-28 -left-10 h-72 w-72 rounded-full bg-brand/10 blur-[95px]" />

          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="glass-chip w-fit text-white/88">CareCircle AI</div>
              <h1 className="hero-display mt-6">Calm care, <br/> one simple step at a time.</h1>
              <p className="hero-body-copy mt-5 text-white/85 sm:text-lg">
                Built for family caregivers who need clarity, not complexity.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:mt-10 sm:gap-4">
              {[
                "Medications that are easy to follow",
                "Journal notes that turn into patterns",
                "Family coordination without confusion"
              ].map((item) => (
                  <div key={item} className="os-shell-soft flex items-center gap-4 p-4 text-white/95 sm:p-5">
                    <div className="h-2 w-2 rounded-full bg-brandLight shadow-[0_0_12px_#818cf8]" />
                    <p className="text-sm font-bold text-white/95 sm:text-[0.98rem]">{item}</p>
                  </div>
                ))}
            </div>

            <div className="hero-stat-grid mt-6">
              {[
                { label: "Setup time", value: "3 min" },
                { label: "Views", value: "Family + clinician" },
                { label: "Feel", value: "Calm and guided" },
              ].map((item) => (
                <div key={item.label} className="os-shell-soft px-4 py-4 text-white">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white/62">{item.label}</p>
                  <p className="mt-2 font-['Outfit'] text-lg font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="mesh-card min-h-[560px] sm:min-h-[620px]">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="glass-chip w-fit">Step {step + 1} of 6</div>
              <h2 className="hero-headline mt-4 text-balance text-textPrimary">{steps[step].title}</h2>
            </div>
            {step > 0 && step < steps.length - 1 ? (
              <Button className="w-full sm:w-auto" variant="ghost" onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}>
                Skip
              </Button>
            ) : null}
          </div>

          <div className="mb-8 rounded-[1.8rem] bg-white/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-textPrimary">Progress</p>
              <p className="text-sm text-textSecondary">{Math.round(((step + 1) / steps.length) * 100)}%</p>
            </div>
            <div className="flex gap-2">
              {steps.map((_, index) => (
                <div key={index} className={`h-2 flex-1 rounded-full ${index <= step ? "bg-brand" : "bg-slate-200"}`} />
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              {steps[step].body}
            </motion.div>
          </AnimatePresence>

          {step > 0 && step < steps.length - 1 ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button className="w-full sm:w-auto" variant="ghost" onClick={() => setStep((current) => Math.max(current - 1, 0))}>
                Back
              </Button>
              <Button className="w-full sm:w-auto" onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

