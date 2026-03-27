import { useMemo, useState } from "react";
import { CalendarCheck2, ChevronLeft, ChevronRight, MapPin, Phone, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import type { AppointmentRecord } from "@carecircle/shared";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, SectionHeader, Select, Textarea } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";
import { hasText, trimmedList, trimmedText } from "@/lib/validation";

const calendarLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const buildCalendarDays = (monthDate: Date, appointments: AppointmentRecord[]) => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startGrid = new Date(start);
  startGrid.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }).map((_, index) => {
    const current = new Date(startGrid);
    current.setDate(startGrid.getDate() + index);
    const iso = current.toISOString().slice(0, 10);
    const dayAppointments = appointments.filter((appointment) => appointment.appointmentDate === iso);
    return {
      iso,
      day: current.getDate(),
      isCurrentMonth: current.getMonth() === monthDate.getMonth(),
      isToday: iso === new Date().toISOString().slice(0, 10),
      appointments: dayAppointments,
    };
  });
};

const specialtyTags: Record<string, string[]> = {
  neurology: ["confusion", "behavior", "mood", "sleep"],
  geriatrics: ["energy", "pain", "confusion", "appetite"],
  primary: ["pain", "energy", "appetite", "mood"],
};

export const AppointmentsPage = () => {
  const { bootstrap, request, refresh } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [prepTarget, setPrepTarget] = useState<AppointmentRecord | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<AppointmentRecord | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [prepEmailLoading, setPrepEmailLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [questionDraft, setQuestionDraft] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [listTab, setListTab] = useState<"upcoming" | "past">("upcoming");
  const [form, setForm] = useState({
    doctorName: "",
    specialty: "",
    clinicName: "",
    appointmentDate: "",
    appointmentTime: "",
    durationMinutes: 30,
    address: "",
    phone: "",
    purpose: "",
    questionsToAsk: [] as string[],
  });

  if (!bootstrap) return null;

  const sortedAppointments = [...bootstrap.data.appointments].sort((left, right) =>
    `${left.appointmentDate}T${left.appointmentTime}`.localeCompare(`${right.appointmentDate}T${right.appointmentTime}`),
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = sortedAppointments.filter((item) => item.status === "upcoming");
  const past = [...sortedAppointments.filter((item) => item.status !== "upcoming")].reverse();
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth, bootstrap.data.appointments), [bootstrap.data.appointments, calendarMonth]);
  const selectedDayAppointments = sortedAppointments.filter((item) => item.appointmentDate === selectedDate);

  const openCreateModal = (appointment?: AppointmentRecord) => {
    if (appointment) {
      setEditingAppointmentId(appointment.id);
      setForm({
        doctorName: appointment.doctorName,
        specialty: appointment.specialty,
        clinicName: appointment.clinicName,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        durationMinutes: appointment.durationMinutes,
        address: appointment.address,
        phone: appointment.phone,
        purpose: appointment.purpose,
        questionsToAsk: appointment.questionsToAsk,
      });
    } else {
      setEditingAppointmentId(null);
      setForm({
        doctorName: "",
        specialty: "",
        clinicName: "",
        appointmentDate: selectedDate,
        appointmentTime: "",
        durationMinutes: 30,
        address: "",
        phone: "",
        purpose: "",
        questionsToAsk: [],
      });
    }
    setModalOpen(true);
  };

  const saveAppointment = async () => {
    const doctorName = trimmedText(form.doctorName);
    const appointmentDate = trimmedText(form.appointmentDate);
    if (!hasText(doctorName) || !hasText(appointmentDate)) {
      toast.error("Please enter the doctor's name and appointment date before saving.");
      return;
    }

    try {
      const payload = {
        ...form,
        doctorName,
        specialty: trimmedText(form.specialty),
        clinicName: trimmedText(form.clinicName),
        appointmentDate,
        appointmentTime: trimmedText(form.appointmentTime),
        address: trimmedText(form.address),
        phone: trimmedText(form.phone),
        purpose: trimmedText(form.purpose),
        questionsToAsk: trimmedList(form.questionsToAsk),
      };
      if (editingAppointmentId) {
        await request(`/appointments/${editingAppointmentId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Appointment updated.");
      } else {
        await request("/appointments", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Appointment saved.");
      }
      setModalOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const cancelAppointment = async (appointment: AppointmentRecord) => {
    if (!window.confirm("Mark this appointment as cancelled?")) return;
    try {
      await request(`/appointments/${appointment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
      toast.success("Appointment cancelled.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const suggestQuestions = async () => {
    try {
      setQuestionLoading(true);
      const result = await request<{ questions: string[] }>("/appointments/suggest-questions", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm((current) => ({ ...current, questionsToAsk: result.questions }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setQuestionLoading(false);
    }
  };

  const addPrepQuestion = async () => {
    if (!prepTarget || !hasText(questionDraft)) return;
    const questions = [...prepTarget.questionsToAsk, trimmedText(questionDraft)];
    try {
      await request(`/appointments/${prepTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ questionsToAsk: questions }),
      });
      setPrepTarget({ ...prepTarget, questionsToAsk: questions });
      setQuestionDraft("");
      toast.success("Question added.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const emailPrepSummary = async () => {
    if (!prepTarget) return;
    try {
      setPrepEmailLoading(true);
      const result = await request<{ sentTo: string }>(`/appointments/${prepTarget.id}/prep-summary-email`, {
        method: "POST",
      });
      toast.success(`Prep summary sent to ${result.sentTo}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setPrepEmailLoading(false);
    }
  };

  const submitFollowUp = async () => {
    if (!followUpTarget) return;
    const notes = trimmedText(followUpNotes);
    if (!hasText(notes)) {
      toast.error("Please write what was discussed before saving follow-up notes.");
      return;
    }
    try {
      await request(`/appointments/${followUpTarget.id}/follow-up`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      toast.success("Follow-up notes saved.");
      setFollowUpTarget(null);
      setFollowUpNotes("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const relevantJournal = prepTarget
    ? bootstrap.data.careJournal
      .filter((entry) => {
        const specialty = prepTarget.specialty.toLowerCase();
        const relevantTags = specialtyTags[specialty] ?? specialtyTags.primary;
        return entry.tags.some((tag) => relevantTags.includes(tag.toLowerCase()));
      })
      .slice(0, 3)
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeader
          title="Calendar view"
          description="Tap any day to see appointments, then open prep notes when you are ready."
          action={<Button onClick={() => openCreateModal()}>Add appointment</Button>}
        />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-lg font-bold text-textPrimary">
              {calendarMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </p>
            <Button variant="ghost" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="secondary" onClick={() => { setCalendarMonth(new Date()); setSelectedDate(todayIso); }}>Today</Button>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-sm">
          {calendarLabels.map((label) => (
            <div key={label} className="py-2 font-semibold text-textSecondary">{label}</div>
          ))}
          {calendarDays.map((day) => (
            <button
              key={day.iso}
              type="button"
              className={`min-h-[92px] rounded-2xl border p-3 text-left transition ${day.iso === selectedDate ? "border-brand bg-brandSoft" : "border-borderColor bg-white"
                } ${day.isCurrentMonth ? "" : "opacity-45"} ${day.isToday ? "ring-2 ring-brand/40" : ""}`}
              onClick={() => setSelectedDate(day.iso)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-textPrimary">{day.day}</span>
                {day.appointments.length ? <Badge tone="brand">{day.appointments.length}</Badge> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {day.appointments.slice(0, 2).map((appointment) => (
                  <span key={appointment.id} className={`h-2.5 w-2.5 rounded-full ${appointment.status === "upcoming" ? "bg-brand" : "bg-slate-400"}`} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card>
          <SectionHeader title={`Appointments for ${formatDate(selectedDate)}`} description="Use Prep Notes to gather questions, medications, and recent care notes." />
          {selectedDayAppointments.length ? (
            <div className="space-y-3">
              {selectedDayAppointments.map((appointment) => (
                <div key={appointment.id} className="rounded-2xl border border-borderColor p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-textPrimary">{appointment.doctorName}</p>
                    <Badge tone={appointment.appointmentDate === todayIso ? "success" : "brand"}>
                      {appointment.appointmentDate === todayIso ? "Today" : appointment.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-textSecondary">{appointment.specialty} | {appointment.clinicName}</p>
                  <p className="mt-2 text-sm text-textPrimary">{appointment.appointmentTime} | {appointment.purpose}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`https://www.google.com/maps/search/${encodeURIComponent(appointment.address)}`} target="_blank" rel="noreferrer">
                      <Button variant="ghost">Get Directions</Button>
                    </a>
                    <Button variant="secondary" onClick={() => setPrepTarget(appointment)}>Prep Notes</Button>
                    <Button variant="ghost" onClick={() => openCreateModal(appointment)}>Edit</Button>
                    <Button variant="ghost" onClick={() => void cancelAppointment(appointment)}>Cancel</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No appointments on this day" description="Pick another day or add a visit to start building prep notes." />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex gap-2">
            <Button variant={listTab === "upcoming" ? "primary" : "ghost"} onClick={() => setListTab("upcoming")}>Upcoming</Button>
            <Button variant={listTab === "past" ? "primary" : "ghost"} onClick={() => setListTab("past")}>Past</Button>
          </div>
          <div className="space-y-3">
            {(listTab === "upcoming" ? upcoming : past).map((appointment) => (
              <div key={appointment.id} className="rounded-2xl border border-borderColor p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-textPrimary">{appointment.doctorName}</p>
                  <Badge tone={appointment.status === "completed" ? "neutral" : appointment.appointmentDate === todayIso ? "success" : "brand"}>
                    {appointment.appointmentDate === todayIso ? "Today" : appointment.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-textSecondary">{appointment.specialty}</p>
                <p className="mt-2 text-sm text-textPrimary">{formatDate(appointment.appointmentDate)} at {appointment.appointmentTime}</p>
                <p className="mt-2 text-sm text-textSecondary">{appointment.followUpSummary ?? appointment.purpose}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listTab === "upcoming" ? (
                    <>
                      <Button variant="ghost" onClick={() => setPrepTarget(appointment)}>Prep Notes</Button>
                      <Button variant="ghost" onClick={() => openCreateModal(appointment)}>Edit</Button>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={() => setFollowUpTarget(appointment)}>
                      <CalendarCheck2 className="h-4 w-4" />
                      Add Notes
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} title={editingAppointmentId ? "Edit appointment" : "Add appointment"} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; void saveAppointment(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Doctor name">
              <Input required value={form.doctorName} placeholder="Example: Dr. Robert Chen" onChange={(event) => setForm((current) => ({ ...current, doctorName: event.target.value }))} />
            </Field>
            <Field label="Specialty">
              <Input value={form.specialty} placeholder="Example: Geriatrician" onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))} />
            </Field>
          </div>
          <Field label="Clinic or hospital">
            <Input value={form.clinicName} placeholder="Example: Riverside Medical Center" onChange={(event) => setForm((current) => ({ ...current, clinicName: event.target.value }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date">
              <Input required type="date" value={form.appointmentDate} onChange={(event) => setForm((current) => ({ ...current, appointmentDate: event.target.value }))} />
            </Field>
            <Field label="Time">
              <Input type="time" value={form.appointmentTime} onChange={(event) => setForm((current) => ({ ...current, appointmentTime: event.target.value }))} />
            </Field>
            <Field label="Duration (minutes)">
              <Input type="number" value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address} placeholder="Example: 1200 Riverside Drive" onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} placeholder="Example: (555) 234-5678" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </Field>
          <Field label="Purpose">
            <Textarea value={form.purpose} placeholder="Example: Follow-up for dizziness and blood sugar" onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} />
          </Field>
          <div className="rounded-3xl bg-brandSoft p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-textPrimary">Questions to ask</p>
                <p className="text-sm text-textSecondary">CareCircle can suggest helpful questions based on this visit.</p>
              </div>
              <Button type="button" variant="secondary" onClick={suggestQuestions} disabled={questionLoading}>
                <Sparkles className="h-4 w-4" />
                {questionLoading ? "Asking our AI..." : "Suggest questions"}
              </Button>
            </div>
            <Textarea className="mt-4" value={form.questionsToAsk.join("\n")} onChange={(event) => setForm((current) => ({ ...current, questionsToAsk: event.target.value.split("\n").filter(Boolean) }))} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editingAppointmentId ? "Save changes" : "Save appointment"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(prepTarget)} title="Prep Notes" onClose={() => setPrepTarget(null)}>
        {prepTarget ? (
          <div className="space-y-4">
            <div className="rounded-3xl bg-brandSoft p-4">
              <p className="font-semibold text-textPrimary">Appointment summary</p>
              <p className="mt-2 text-sm text-textSecondary">{prepTarget.doctorName} - {prepTarget.specialty}</p>
              <p className="mt-1 text-sm text-textSecondary">{formatDate(prepTarget.appointmentDate)} at {prepTarget.appointmentTime}</p>
              <p className="mt-1 text-sm text-textSecondary">{prepTarget.clinicName} | {prepTarget.address}</p>
              {prepTarget.phone ? (
                <a href={`tel:${prepTarget.phone.replaceAll(/[^0-9]/g, "")}`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brandDark">
                  <Phone className="h-4 w-4" />
                  Call Clinic
                </a>
              ) : null}
            </div>

            <div className="rounded-3xl border border-borderColor p-4">
              <p className="font-semibold text-textPrimary">Questions to ask</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Textarea className="min-w-0 flex-1" value={questionDraft} placeholder="Add a question..." onChange={(event) => setQuestionDraft(event.target.value)} />
                <Button className="sm:self-end" onClick={() => void addPrepQuestion()}>Add</Button>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-textSecondary">
                {prepTarget.questionsToAsk.map((question) => (
                  <li key={question}>- {question}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-borderColor p-4">
              <p className="font-semibold text-textPrimary">Recent relevant journal entries</p>
              <div className="mt-3 space-y-3">
                {relevantJournal.length ? relevantJournal.map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="font-semibold text-textPrimary">{entry.entryTitle}</p>
                    <p className="mt-1 text-sm text-textSecondary">{entry.entryBody}</p>
                  </div>
                )) : <p className="text-sm text-textSecondary">No specialty-matched notes yet. General notes still help if something changes before the visit.</p>}
              </div>
            </div>

            <div className="rounded-3xl border border-borderColor p-4">
              <p className="font-semibold text-textPrimary">Current medications list</p>
              <div className="mt-3 space-y-2 text-sm text-textSecondary">
                {bootstrap.data.medications.filter((item) => item.isActive).map((medication) => (
                  <p key={medication.id}>{medication.name} {medication.doseAmount}{medication.doseUnit} - {medication.purpose}</p>
                ))}
              </div>
            </div>

            <Button variant="secondary" onClick={() => void emailPrepSummary()} disabled={prepEmailLoading}>
              {prepEmailLoading ? "Sending prep summary..." : "Email myself a prep summary"}
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(followUpTarget)} title="How did it go?" onClose={() => setFollowUpTarget(null)}>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; void submitFollowUp(); }}>
          <Field label="What was discussed?">
            <Textarea required value={followUpNotes} placeholder="What changed? Any new medications? Any next steps?" onChange={(event) => setFollowUpNotes(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setFollowUpTarget(null)}>Cancel</Button>
            <Button type="submit">Save notes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
