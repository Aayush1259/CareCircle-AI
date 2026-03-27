import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import type { CareJournalRecord } from "@carecircle/shared";
import { Badge, Button, Card, Field, Input, Modal, SectionHeader, Select, Textarea, Toggle } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate, relativeTime } from "@/lib/format";
import { hasText, trimmedText } from "@/lib/validation";

const severityTone = {
  low: "success",
  medium: "warning",
  high: "danger",
  emergency: "danger",
} as const;

export const JournalPage = () => {
  const { bootstrap, request, refresh } = useAppData();
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(bootstrap?.data.careJournal[0]?.id ?? null);
  const [modalOpen, setModalOpen] = useState(false);
  const [patternReport, setPatternReport] = useState<{
    patterns: string[];
    concerns: string[];
    doctor_topics: string[];
    positives: string[];
  } | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    entryTitle: "",
    entryBody: "",
    mood: 3,
    painLevel: 2,
    severity: "low",
    tags: [] as string[],
    followUpNeeded: false,
    followUpNote: "",
  });

  if (!bootstrap) return null;

  const entries = useMemo(() => {
    return bootstrap.data.careJournal.filter((entry) => {
      const matchesQuery =
        query.length === 0 ||
        entry.entryTitle.toLowerCase().includes(query.toLowerCase()) ||
        entry.entryBody.toLowerCase().includes(query.toLowerCase());
      const matchesSeverity = severityFilter === "all" || entry.severity === severityFilter;
      return matchesQuery && matchesSeverity;
    });
  }, [bootstrap.data.careJournal, query, severityFilter]);

  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? entries[0];

  const saveEntry = async () => {
    const date = trimmedText(form.date);
    const entryBody = trimmedText(form.entryBody);
    const followUpNote = trimmedText(form.followUpNote);

    if (!hasText(date) || !hasText(entryBody)) {
      toast.error("Please add the date and what happened before saving this care note.");
      return;
    }

    if (form.followUpNeeded && !hasText(followUpNote)) {
      toast.error("Please add a follow-up note or turn follow-up off before saving.");
      return;
    }

    try {
      await request("/journal", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          date,
          time: trimmedText(form.time),
          entryTitle: trimmedText(form.entryTitle),
          entryBody,
          followUpNote,
        }),
      });
      toast.success("Care note saved.");
      setModalOpen(false);
      setForm({
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 5),
        entryTitle: "",
        entryBody: "",
        mood: 3,
        painLevel: 2,
        severity: "low",
        tags: [],
        followUpNeeded: false,
        followUpNote: "",
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const analyzeEntry = async (entry: CareJournalRecord) => {
    try {
      await request(`/journal/${entry.id}/analyze`, { method: "POST" });
      toast.success("AI analysis is ready.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const analyzePatterns = async () => {
    try {
      const result = await request<{
        patterns: string[];
        concerns: string[];
        doctor_topics: string[];
        positives: string[];
      }>("/journal/analyze-30-days", { method: "POST" });
      setPatternReport(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
      <Card className="h-fit">
        <SectionHeader
          title="Care journal"
          description="Search, filter, and find what changed."
          action={<Button onClick={() => setModalOpen(true)}>New entry</Button>}
        />
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr,180px]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
              <Input value={query} placeholder="Search entries..." className="pl-11" onChange={(event) => setQuery(event.target.value)} />
            </div>
            <Select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
              <option value="all">All severity</option>
              <option value="low">Just noting</option>
              <option value="medium">Worth watching</option>
              <option value="high">Concerning</option>
              <option value="emergency">Emergency</option>
            </Select>
          </div>
          <div className="space-y-3">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedId(entry.id)}
                className={`w-full rounded-3xl border p-4 text-left ${selectedEntry?.id === entry.id ? "border-brand bg-brandSoft/50" : "border-borderColor bg-white"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-textPrimary">{entry.entryTitle}</p>
                  <Badge tone={severityTone[entry.severity]}>{entry.severity}</Badge>
                  {entry.isNew ? <Badge tone="brand">NEW</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-textSecondary">
                  {formatDate(entry.date)} at {entry.time}
                </p>
                <p className="mt-2 text-sm text-textSecondary">{entry.entryBody.slice(0, 90)}...</p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        {selectedEntry ? (
          <Card>
            <SectionHeader
              title={selectedEntry.entryTitle}
              description={`${formatDate(selectedEntry.date)} at ${selectedEntry.time} | ${relativeTime(selectedEntry.createdAt)}`}
              action={
                <Button variant="secondary" onClick={() => analyzeEntry(selectedEntry)}>
                  <Sparkles className="h-4 w-4" />
                  AI analysis
                </Button>
              }
            />
            <div className="space-y-4">
              <p className="text-base text-textPrimary">{selectedEntry.entryBody}</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand">Mood {selectedEntry.mood}/5</Badge>
                <Badge tone="warning">Pain {selectedEntry.painLevel}/10</Badge>
                {selectedEntry.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
              {selectedEntry.followUpNeeded ? (
                <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Follow-up needed</p>
                  <p className="mt-1">{selectedEntry.followUpNote}</p>
                </div>
              ) : null}
              {selectedEntry.aiAnalysis ? (
                <div className="rounded-3xl bg-brandSoft p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brandDark">AI analysis</p>
                  <p className="mt-3 text-base text-textPrimary">{selectedEntry.aiAnalysis.summary}</p>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">Flag for the doctor</p>
                      <ul className="mt-2 space-y-2 text-sm text-textSecondary">
                        {selectedEntry.aiAnalysis.doctorFlags.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">Action steps</p>
                      <ul className="mt-2 space-y-2 text-sm text-textSecondary">
                        {selectedEntry.aiAnalysis.actionSteps.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">Questions to write down</p>
                      <ul className="mt-2 space-y-2 text-sm text-textSecondary">
                        {selectedEntry.aiAnalysis.questions.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        <Card>
          <SectionHeader
            title="30-day pattern analysis"
            description="Let CareCircle scan recent notes for trends, concerns, and bright spots."
            action={<Button onClick={analyzePatterns}>Analyze last 30 days</Button>}
          />
          {patternReport ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="font-semibold text-textPrimary">Patterns</p>
                <ul className="mt-2 space-y-2 text-sm text-textSecondary">
                  {patternReport.patterns.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-amber-50 p-4">
                <p className="font-semibold text-amber-900">Concerns</p>
                <ul className="mt-2 space-y-2 text-sm text-amber-900/80">
                  {patternReport.concerns.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-brandSoft p-4">
                <p className="font-semibold text-brandDark">Doctor topics</p>
                <ul className="mt-2 space-y-2 text-sm text-textSecondary">
                  {patternReport.doctor_topics.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-800">Positives to celebrate</p>
                <ul className="mt-2 space-y-2 text-sm text-emerald-800/80">
                  {patternReport.positives.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-borderColor p-8 text-center text-textSecondary">
              Tap "Analyze last 30 days" to see patterns in plain language.
            </div>
          )}
        </Card>
      </div>

      <Modal open={modalOpen} title="New care journal entry" onClose={() => setModalOpen(false)}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            void saveEntry();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <Input required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            </Field>
            <Field label="Time">
              <Input type="time" value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} />
            </Field>
          </div>
          <Field label="Entry title">
            <Input value={form.entryTitle} placeholder="Leave blank and CareCircle will suggest one" onChange={(event) => setForm((current) => ({ ...current, entryTitle: event.target.value }))} />
          </Field>
          <Field label="What happened?">
            <Textarea required value={form.entryBody} placeholder="Describe what you observed in plain words..." onChange={(event) => setForm((current) => ({ ...current, entryBody: event.target.value }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Mood">
              <Select value={String(form.mood)} onChange={(event) => setForm((current) => ({ ...current, mood: Number(event.target.value) }))}>
                <option value="1">1 - Very low</option>
                <option value="2">2 - Low</option>
                <option value="3">3 - Neutral</option>
                <option value="4">4 - Better</option>
                <option value="5">5 - Good</option>
              </Select>
            </Field>
            <Field label="Pain level">
              <Input type="number" min="0" max="10" value={form.painLevel} onChange={(event) => setForm((current) => ({ ...current, painLevel: Number(event.target.value) }))} />
            </Field>
            <Field label="Severity">
              <Select value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}>
                <option value="low">Just noting</option>
                <option value="medium">Worth watching</option>
                <option value="high">Concerning</option>
                <option value="emergency">Emergency</option>
              </Select>
            </Field>
          </div>
          <Field label="Tags">
            <div className="flex flex-wrap gap-2">
              {["fall", "confusion", "appetite", "sleep", "mood", "pain", "bathroom", "behavior", "energy", "skin", "breathing"].map((tag) => {
                const selected = form.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${selected ? "bg-brand text-white" : "bg-slate-100 text-textSecondary"}`}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        tags: selected ? current.tags.filter((item) => item !== tag) : [...current.tags, tag],
                      }))
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
            <div>
              <p className="font-semibold text-textPrimary">Does this need follow-up?</p>
              <p className="text-sm text-textSecondary">Turn this on if you want a reminder for the next visit.</p>
            </div>
            <Toggle checked={form.followUpNeeded} onChange={(value) => setForm((current) => ({ ...current, followUpNeeded: value }))} />
          </div>
          {form.followUpNeeded ? (
            <Field label="Follow-up note">
              <Input required={form.followUpNeeded} value={form.followUpNote} placeholder="Example: Mention the increased confusion at neurology" onChange={(event) => setForm((current) => ({ ...current, followUpNote: event.target.value }))} />
            </Field>
          ) : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save entry</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
