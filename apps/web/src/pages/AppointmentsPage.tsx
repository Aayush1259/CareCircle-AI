import { useMemo, useState } from "react";
import { CalendarCheck2, ChevronLeft, ChevronRight, MapPin, Phone, Sparkles, Clock, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 pb-28 sm:space-y-8 lg:pb-0"
    >
      <Card className="rounded-[2rem] p-4 shadow-calm sm:p-6 lg:rounded-[2.5rem] lg:p-8">
        <SectionHeader
          title="Calendar view"
          titleClassName="font-['Outfit'] text-2xl font-bold sm:text-3xl"
          description="Tap any day to see appointments, then open prep notes when you are ready."
          action={
            <Button onClick={() => openCreateModal()} className="w-full px-5 py-3.5 sm:w-auto sm:px-6 sm:py-4">
              Add appointment
            </Button>
          }
        />
        <div className="mb-6 grid gap-3 rounded-[1.75rem] border border-slate-100 bg-slate-50/90 p-3 sm:mb-8 sm:gap-4 sm:rounded-[2rem] sm:p-4">
          <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              className="h-11 w-11 rounded-full border border-white/70 bg-white/75 p-0 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.35)] hover:bg-white sm:h-12 sm:w-12"
              onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <p className="min-w-0 text-center font-['Outfit'] text-xl font-bold text-textPrimary sm:min-w-[180px] sm:text-[1.9rem]">
              {calendarMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </p>
            <Button
              variant="ghost"
              className="h-11 w-11 rounded-full border border-white/70 bg-white/75 p-0 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.35)] hover:bg-white sm:h-12 sm:w-12"
              onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <Button
            variant="secondary"
            className="w-full rounded-[1.2rem] border border-slate-200 bg-white px-5 py-3.5 shadow-[0_18px_34px_-28px_rgba(79,70,229,0.35)] sm:w-auto sm:justify-self-start sm:px-6"
            onClick={() => {
              setCalendarMonth(new Date());
              setSelectedDate(todayIso);
            }}
          >
            Go to Today
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-x-1.5 gap-y-2.5 text-center text-sm sm:gap-3">
          {calendarLabels.map((label) => (
            <div key={label} className="py-1.5 font-['Outfit'] text-[0.68rem] font-bold uppercase tracking-[0.22em] text-textSecondary sm:py-2 sm:text-xs">
              {label}
            </div>
          ))}
          {calendarDays.map((day) => (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={day.iso}
              type="button"
              className={`aspect-[0.94] min-h-0 overflow-hidden rounded-[1.15rem] border p-2 text-left transition-all duration-300 shadow-sm sm:aspect-auto sm:min-h-[110px] sm:rounded-[1.5rem] sm:p-4 ${
                day.iso === selectedDate
                  ? "z-10 border-brand bg-brandSoft/40 ring-2 ring-brand/10 shadow-md sm:scale-[1.02]"
                  : "border-borderColor bg-white hover:border-brand/20 hover:bg-slate-50/50"
              } ${day.isCurrentMonth ? "" : "opacity-35"} ${day.isToday ? "ring-2 ring-brand/40 bg-brandSoft/10" : ""}`}
              onClick={() => setSelectedDate(day.iso)}
            >
              <div className="flex h-full flex-col justify-between gap-2">
                <div className="flex items-start justify-between gap-1">
                  <span className={`text-sm font-['Outfit'] font-bold sm:text-base ${day.isToday ? "text-brand" : "text-textPrimary"}`}>{day.day}</span>
                  {day.appointments.length ? (
                    <Badge tone="brand" className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.62rem] sm:h-6 sm:min-w-6 sm:px-0">
                      {day.appointments.length}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-auto flex flex-wrap gap-1 sm:gap-1.5">
                  {day.appointments.slice(0, 3).map((appointment) => (
                    <span key={appointment.id} className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${appointment.status === "upcoming" ? "bg-brand animate-pulse" : "bg-slate-300"}`} />
                  ))}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </Card>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="rounded-[2.5rem] p-8">
            <SectionHeader
              title={`Visits for ${formatDate(selectedDate)}`}
              titleClassName="font-['Outfit'] text-2xl font-bold"
              description="A focused view for preparation and navigation."
            />
            {selectedDayAppointments.length ? (
              <div className="space-y-4 mt-6">
                {selectedDayAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-[1.5rem] border border-borderColor bg-white p-6 transition-all hover:border-brand hover:shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-['Outfit'] text-2xl font-bold text-textPrimary">{appointment.doctorName}</p>
                        <Badge tone={appointment.appointmentDate === todayIso ? "success" : "brand"}>
                          {appointment.appointmentDate === todayIso ? "Today" : appointment.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-textSecondary font-medium">
                        <Clock className="h-4 w-4" />
                        {appointment.appointmentTime}
                      </div>
                    </div>
                    <p className="mt-2 text-lg text-textSecondary font-medium">{appointment.specialty} | {appointment.clinicName}</p>
                    <p className="mt-3 text-base text-textPrimary leading-relaxed leading-relaxed">{appointment.purpose}</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <a href={`https://www.google.com/maps/search/${encodeURIComponent(appointment.address)}`} target="_blank" rel="noreferrer" className="flex-1 min-w-[140px]">
                        <Button variant="ghost" className="w-full border border-slate-100 rounded-xl hover:bg-slate-50">
                          <MapPin className="h-4 w-4 mr-2" />
                          Directions
                        </Button>
                      </a>
                      <Button variant="secondary" className="flex-1 min-w-[140px] rounded-xl" onClick={() => setPrepTarget(appointment)}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Prep Notes
                      </Button>
                      <Button variant="ghost" className="flex-1 min-w-[140px] rounded-xl" onClick={() => openCreateModal(appointment)}>
                        Edit
                      </Button>
                      <Button variant="ghost" className="flex-1 min-w-[140px] rounded-xl text-danger hover:bg-red-50" onClick={() => void cancelAppointment(appointment)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-8">
                <EmptyState title="Quiet day on the calendar" description="Pick another date or schedule a formal visit to start building preparation notes." />
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="rounded-[2.5rem] p-8 h-full">
            <div className="mb-8 flex gap-3 p-1 bg-slate-50 rounded-2xl w-fit">
              <button
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${listTab === "upcoming" ? "bg-white text-brand shadow-sm" : "text-textSecondary hover:text-textPrimary"}`}
                onClick={() => setListTab("upcoming")}
              >
                Upcoming
              </button>
              <button
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${listTab === "past" ? "bg-white text-brand shadow-sm" : "text-textSecondary hover:text-textPrimary"}`}
                onClick={() => setListTab("past")}
              >
                Past
              </button>
            </div>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {(listTab === "upcoming" ? upcoming : past).map((appointment, index) => (
                  <motion.div
                    key={appointment.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-[1.25rem] border border-borderColor bg-white/50 p-5 shadow-sm hover:border-brand/30 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-['Outfit'] font-bold text-textPrimary text-lg">{appointment.doctorName}</p>
                      <Badge tone={appointment.status === "completed" ? "neutral" : appointment.appointmentDate === todayIso ? "success" : "brand"}>
                        {appointment.appointmentDate === todayIso ? "Today" : appointment.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-textSecondary font-medium">{appointment.specialty}</p>
                    <div className="mt-3 flex items-center gap-3 text-sm text-textPrimary bg-slate-100/50 p-2 rounded-xl border border-slate-100">
                      <Calendar className="h-4 w-4 text-brand" />
                      {formatDate(appointment.appointmentDate)} at {appointment.appointmentTime}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {listTab === "upcoming" ? (
                        <>
                          <Button variant="ghost" className="px-4 py-2 text-sm rounded-xl border border-slate-100 bg-white" onClick={() => setPrepTarget(appointment)}>
                            <Sparkles className="h-3.5 w-3.5 mr-2" />
                            Build Prep
                          </Button>
                          <Button variant="ghost" className="px-4 py-2 text-sm rounded-xl border border-slate-100 bg-white" onClick={() => openCreateModal(appointment)}>
                            Edit
                          </Button>
                        </>
                      ) : (
                        <Button variant="secondary" className="px-4 py-2 text-sm rounded-xl" onClick={() => setFollowUpTarget(appointment)}>
                          <CalendarCheck2 className="h-3.5 w-3.5 mr-2" />
                          Add Follow-up
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Preparation Notes Drawer-style Modal */}
      <Modal open={Boolean(prepTarget)} title="Appointment Preparation" onClose={() => setPrepTarget(null)} className="max-w-2xl">
        {prepTarget ? (
          <div className="space-y-8 p-1">
            <div className="rounded-[2rem] bg-gradient-to-br from-brand/90 to-brandDark p-8 text-white shadow-lg overflow-hidden relative">
              <div className="relative z-10">
                <p className="text-white/70 font-bold uppercase tracking-widest text-xs mb-3">Target Provider</p>
                <h2 className="font-['Outfit'] text-3xl font-bold">{prepTarget.doctorName}</h2>
                <p className="mt-1 text-white/80 font-medium">{prepTarget.specialty} | {prepTarget.clinicName}</p>
                <div className="mt-6 flex flex-wrap gap-4 text-sm font-medium">
                  <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm">
                    <Calendar className="h-4 w-4" />
                    {formatDate(prepTarget.appointmentDate)}
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm">
                    <Clock className="h-4 w-4" />
                    {prepTarget.appointmentTime}
                  </div>
                </div>
              </div>
              <Sparkles className="absolute -right-4 -bottom-4 h-32 w-32 text-white/5" />
            </div>

            <div className="space-y-6">
              <div className="rounded-[1.5rem] border border-borderColor p-6 bg-white shadow-sm">
                <p className="font-['Outfit'] font-bold text-xl text-textPrimary mb-4">Questions to ask</p>
                <div className="flex gap-2">
                  <Input
                    value={questionDraft}
                    className="h-12 rounded-xl"
                    placeholder="Type a concern or clinical question..."
                    onChange={(event) => setQuestionDraft(event.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void addPrepQuestion()}
                  />
                  <Button className="h-12 px-6 rounded-xl" onClick={() => void addPrepQuestion()}>Add</Button>
                </div>
                <div className="mt-6 space-y-3">
                  {prepTarget.questionsToAsk.map((question, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl text-textSecondary text-sm border border-slate-100"
                    >
                      <span className="text-brand font-bold mt-0.5">•</span>
                      {question}
                    </motion.div>
                  ))}
                  {prepTarget.questionsToAsk.length === 0 && (
                    <p className="text-center py-4 text-sm text-textSecondary italic">No questions added yet. Use the input above to start your list.</p>
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-borderColor p-6 bg-white shadow-sm">
                <p className="font-['Outfit'] font-bold text-xl text-textPrimary mb-4">Relevant Patient Data</p>
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-3">Medications List</p>
                    <div className="space-y-2">
                      {bootstrap.data.medications.filter((item) => item.isActive).map((medication) => (
                        <div key={medication.id} className="text-sm text-emerald-900/80 flex justify-between">
                          <span className="font-bold">{medication.name}</span>
                          <span>{medication.doseAmount}{medication.doseUnit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {relevantJournal.length > 0 && (
                    <div className="p-4 bg-brandSoft/30 rounded-2xl border border-brand/5">
                      <p className="text-xs font-bold text-brandDark uppercase tracking-widest mb-3">Context from notes</p>
                      <div className="space-y-3">
                        {relevantJournal.map((entry) => (
                          <div key={entry.id} className="text-sm">
                            <p className="font-bold text-textPrimary">{entry.entryTitle}</p>
                            <p className="text-textSecondary text-xs line-clamp-2 mt-1">{entry.entryBody}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1 py-6 rounded-2xl" onClick={() => setPrepTarget(null)}>Close</Button>
              <Button
                variant="secondary"
                className="flex-[2] py-6 rounded-2xl shadow-brand/10 shadow-lg"
                onClick={() => void emailPrepSummary()}
                disabled={prepEmailLoading}
              >
                {prepEmailLoading ? "Sending summary..." : "Send prep to mobile"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={modalOpen} title={editingAppointmentId ? "Edit appointment" : "Add appointment"} onClose={() => setModalOpen(false)}>
        <form className="grid gap-6 p-2" onSubmit={(event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; void saveAppointment(); }}>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Doctor name">
              <Input required value={form.doctorName} className="h-12 rounded-xl" placeholder="Example: Dr. Robert Chen" onChange={(event) => setForm((current) => ({ ...current, doctorName: event.target.value }))} />
            </Field>
            <Field label="Specialty">
              <Input value={form.specialty} className="h-12 rounded-xl" placeholder="Example: Geriatrician" onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))} />
            </Field>
          </div>
          <Field label="Clinic or hospital">
            <Input value={form.clinicName} className="h-12 rounded-xl" placeholder="Example: Riverside Medical Center" onChange={(event) => setForm((current) => ({ ...current, clinicName: event.target.value }))} />
          </Field>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="Date">
              <Input required type="date" value={form.appointmentDate} className="h-12 rounded-xl" onChange={(event) => setForm((current) => ({ ...current, appointmentDate: event.target.value }))} />
            </Field>
            <Field label="Time">
              <Input type="time" value={form.appointmentTime} className="h-12 rounded-xl" onChange={(event) => setForm((current) => ({ ...current, appointmentTime: event.target.value }))} />
            </Field>
            <Field label="Duration (min)">
              <Input type="number" value={form.durationMinutes} className="h-12 rounded-xl" onChange={(event) => setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address} className="h-12 rounded-xl" placeholder="Full address for map links..." onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          </Field>
          <div className="rounded-[1.5rem] bg-brandSoft/30 p-6 border border-brand/10">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="font-['Outfit'] font-bold text-lg text-textPrimary">Questions list</p>
                <p className="text-sm text-textSecondary">CareCircle AI can suggest specialty-matched questions.</p>
              </div>
              <Button type="button" variant="secondary" className="px-5 rounded-xl" onClick={suggestQuestions} disabled={questionLoading}>
                <Sparkles className="h-4 w-4 mr-2" />
                {questionLoading ? "Asking AI..." : "Suggest questions"}
              </Button>
            </div>
            <Textarea
              className="min-h-[140px] rounded-2xl bg-white/50"
              placeholder="List one question per line..."
              value={form.questionsToAsk.join("\n")}
              onChange={(event) => setForm((current) => ({ ...current, questionsToAsk: event.target.value.split("\n").filter(Boolean) }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-6">
            <Button type="button" variant="ghost" className="px-8 rounded-xl" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="px-8 rounded-xl">{editingAppointmentId ? "Save changes" : "Save appointment"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(followUpTarget)} title="Visit Discussion Notes" onClose={() => setFollowUpTarget(null)}>
        <form className="grid gap-6 p-2" onSubmit={(event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; void submitFollowUp(); }}>
          <Field label="What was discussed?">
            <Textarea
              required
              value={followUpNotes}
              className="min-h-[220px] rounded-2xl p-4"
              placeholder="What changed? Any new medications? Any next steps for the care team?"
              onChange={(event) => setFollowUpNotes(event.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" className="px-8 rounded-xl" onClick={() => setFollowUpTarget(null)}>Cancel</Button>
            <Button type="submit" className="px-8 rounded-xl">Save notes</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};
