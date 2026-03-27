import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, HeartHandshake, Pill, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { calcAge } from "@/lib/format";

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
  const { request, refresh } = useAppData();
  const [step, setStep] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [form, setForm] = useState({
    name: "Sarah Martinez",
    email: "demo@carecircle.ai",
    password: "Demo1234",
    role: "caregiver",
    patientName: 'Eleanor "Ellie" Martinez',
    dateOfBirth: "1948-04-18",
    conditions: ["Type 2 Diabetes", "Hypertension", "Early-stage Alzheimer's", "Arthritis"],
    doctorName: "Dr. Robert Chen",
    doctorPhone: "(555) 234-5678",
    medicationName: "Metformin",
    medicationDose: "500",
    medicationPurpose: "Helps keep blood sugar steadier throughout the day.",
    familyEmail: "james@carecircle.ai",
  });

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
      navigate("/dashboard");
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
            <div className="flex gap-3">
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
          <div className="rounded-3xl bg-brandSoft p-6">
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
    <div className="min-h-screen bg-transparent px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr,1.05fr]">
        <Card className="overflow-hidden bg-gradient-to-br from-brand to-brandDark text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/75">CareCircle AI</p>
          <h1 className="mt-6 text-4xl font-extrabold">Calm care, one simple step at a time.</h1>
          <p className="mt-4 text-lg text-white/85">
            Built for family caregivers who need clarity, not complexity.
          </p>
          <div className="mt-10 grid gap-3">
            {["Medications that are easy to follow", "Journal notes that turn into useful patterns", "Family coordination without confusion"].map((item) => (
              <div key={item} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white/90">
                {item}
              </div>
            ))}
          </div>
        </Card>

        <Card className="min-h-[620px]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="eyebrow">Step {step + 1} of 6</p>
              <h2 className="mt-2 text-3xl font-bold text-textPrimary">{steps[step].title}</h2>
            </div>
            {step > 0 && step < steps.length - 1 ? (
              <Button variant="ghost" onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}>
                Skip
              </Button>
            ) : null}
          </div>

          <div className="mb-8 flex gap-2">
            {steps.map((_, index) => (
              <div key={index} className={`h-2 flex-1 rounded-full ${index <= step ? "bg-brand" : "bg-slate-200"}`} />
            ))}
          </div>

          {steps[step].body}

          {step > 0 && step < steps.length - 1 ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep((current) => Math.max(current - 1, 0))}>
                Back
              </Button>
              <Button onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}>
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

