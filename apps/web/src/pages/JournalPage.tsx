import { useEffect, useMemo, useState } from "react";
import { Lock, Search, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { CareJournalRecord } from "@carecircle/shared";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, SectionHeader, Select, Textarea, Toggle } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate, relativeTime } from "@/lib/format";
import { resolveViewerRole } from "@/lib/roles";
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
  const [saveBusy, setSaveBusy] = useState(false);
  const [analyzingEntryId, setAnalyzingEntryId] = useState<string | null>(null);
  const [patternBusy, setPatternBusy] = useState(false);
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

  const viewerRole = resolveViewerRole(bootstrap.viewer.role, bootstrap.viewerAccess?.accessRole);
  const capabilities =
    bootstrap.capabilities ??
    (viewerRole === "family_member"
      ? ["view_journal"]
      : viewerRole === "doctor"
        ? ["view_journal", "view_ai_insights"]
        : ["log_journal", "view_ai_insights"]);
  const canLogJournal = capabilities.includes("log_journal");
  const canViewAiInsights = capabilities.includes("view_ai_insights");
  const canAnalyzeEntries = canViewAiInsights && canLogJournal;

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

  useEffect(() => {
    if (!selectedEntry && selectedId !== null) {
      setSelectedId(null);
      return;
    }
    if (selectedEntry && selectedEntry.id !== selectedId) {
      setSelectedId(selectedEntry.id);
    }
  }, [selectedEntry, selectedId]);

  const resetForm = () =>
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

  const closeModal = () => {
    if (saveBusy) return;
    setModalOpen(false);
  };

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

    setSaveBusy(true);
    try {
      const result = await request<{ entry: CareJournalRecord }>("/journal", {
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
      setSelectedId(result.entry.id);
      setModalOpen(false);
      resetForm();
      setPatternReport(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const analyzeEntry = async (entry: CareJournalRecord) => {
    setAnalyzingEntryId(entry.id);
    try {
      await request(`/journal/${entry.id}/analyze`, { method: "POST" });
      toast.success("AI analysis is ready.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setAnalyzingEntryId(null);
    }
  };

  const analyzePatterns = async () => {
    setPatternBusy(true);
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
    } finally {
      setPatternBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-8 xl:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]"
    >
      <Card className="h-fit rounded-[2.5rem] p-8">
        <SectionHeader
          title="Care journal"
          titleClassName="responsive-title-lg"
          description={
            viewerRole === "family_member"
              ? "Shared notes and your own entries, without the clinician-only AI tools."
              : viewerRole === "doctor"
                ? "Review what caregivers have shared and add context when needed."
                : "Search, filter, and find what changed."
          }
          action={canLogJournal ? <Button onClick={() => setModalOpen(true)} disabled={saveBusy} className="px-6 py-4">New entry</Button> : undefined}
        />
        <div className="space-y-6 mt-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
              <Input
                value={query}
                placeholder="Search entries..."
                className="pl-11 h-12 rounded-2xl"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Select
              value={severityFilter}
              className="h-12 rounded-2xl"
              onChange={(event) => setSeverityFilter(event.target.value)}
            >
              <option value="all">All severity</option>
              <option value="low">Just noting</option>
              <option value="medium">Worth watching</option>
              <option value="high">Concerning</option>
              <option value="emergency">Emergency</option>
            </Select>
          </div>

          <div className="space-y-3 mt-8">
            <AnimatePresence mode="popLayout">
              {entries.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  key="empty"
                >
                  <EmptyState title="No journal entries match" description="Try a different search or add a new care note." />
                </motion.div>
              ) : (
                entries.map((entry, index) => (
                  <motion.button
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    type="button"
                    onClick={() => setSelectedId(entry.id)}
                    className={`w-full rounded-[1.25rem] border p-5 text-left transition-all duration-300 ${
                      selectedEntry?.id === entry.id
                        ? "border-brand bg-brandSoft/40 ring-2 ring-brand/10 shadow-lg scale-[1.02]"
                        : "border-borderColor bg-white hover:border-brand/30 hover:shadow-md"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-['Outfit'] font-bold text-textPrimary text-lg">{entry.entryTitle}</p>
                        <Badge tone={severityTone[entry.severity]}>{entry.severity}</Badge>
                        {entry.isNew ? <Badge tone="brand">NEW</Badge> : null}
                      </div>
                      <p className="text-xs font-semibold text-textSecondary uppercase tracking-wider">
                        {formatDate(entry.date)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-textSecondary line-clamp-2 leading-relaxed">
                      {entry.entryBody}
                    </p>
                  </motion.button>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>

      <div className="space-y-8">
        <AnimatePresence mode="wait">
          {selectedEntry ? (
            <motion.div
              key={selectedEntry.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Card className="rounded-[2.5rem] p-8 shadow-calm">
                <SectionHeader
                  title={selectedEntry.entryTitle}
                  titleClassName="responsive-title-lg"
                  description={`${formatDate(selectedEntry.date)} at ${selectedEntry.time} | ${relativeTime(selectedEntry.createdAt)}`}
                  action={canAnalyzeEntries ? (
                    <Button
                      variant="secondary"
                      onClick={() => analyzeEntry(selectedEntry)}
                      disabled={analyzingEntryId === selectedEntry.id}
                      className="px-6"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {analyzingEntryId === selectedEntry.id ? "Analyzing..." : "AI analysis"}
                    </Button>
                  ) : undefined}
                />
                <div className="space-y-8 mt-8">
                  <div className="prose prose-slate max-w-none">
                    <p className="text-lg leading-relaxed text-textPrimary font-['Inter']">
                      {selectedEntry.entryBody}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4">
                    <Badge tone="brand" className="px-3 py-1 text-sm font-semibold">Mood {selectedEntry.mood}/5</Badge>
                    <Badge tone="warning" className="px-3 py-1 text-sm font-semibold">Pain {selectedEntry.painLevel}/10</Badge>
                    {selectedEntry.tags.map((tag) => (
                      <Badge key={tag} className="px-3 py-1 text-sm font-semibold bg-slate-100 text-slate-700">{tag}</Badge>
                    ))}
                  </div>

                  {selectedEntry.followUpNeeded ? (
                    <div className="rounded-[1.5rem] bg-amber-50 border border-amber-100 p-6 text-sm text-amber-900 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <p className="font-['Outfit'] font-bold text-base">Follow-up needed</p>
                      </div>
                      <p className="text-base text-amber-900/80 leading-relaxed">{selectedEntry.followUpNote}</p>
                    </div>
                  ) : null}

                  {selectedEntry.aiAnalysis ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-[2rem] bg-brandSoft/30 backdrop-blur-md border border-brand/10 p-8 shadow-premium"
                    >
                      <div className="flex items-center gap-2 mb-6">
                        <Sparkles className="h-5 w-5 text-brand" />
                        <p className="font-['Outfit'] text-sm font-bold uppercase tracking-[0.2em] text-brandDark">AI Analysis</p>
                      </div>

                      <p className="text-lg text-textPrimary leading-relaxed font-['Inter'] font-medium">
                        {selectedEntry.aiAnalysis.summary}
                      </p>

                      <div className="mt-8 grid gap-6 lg:grid-cols-2">
                        <div className="bg-white/40 rounded-2xl p-6">
                          <p className="font-['Outfit'] font-bold text-textPrimary mb-3">Flag for the doctor</p>
                          <ul className="space-y-2 text-sm text-textSecondary">
                            {selectedEntry.aiAnalysis.doctorFlags.map((item) => (
                              <li key={item} className="flex items-start gap-2">
                                <span className="text-brand font-bold">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-white/40 rounded-2xl p-6">
                          <p className="font-['Outfit'] font-bold text-textPrimary mb-3">Action steps</p>
                          <ul className="space-y-2 text-sm text-textSecondary">
                            {selectedEntry.aiAnalysis.actionSteps.map((item) => (
                              <li key={item} className="flex items-start gap-2">
                                <span className="text-success font-bold">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-6 bg-brandDark text-white rounded-2xl p-6 shadow-lg">
                        <p className="font-['Outfit'] font-bold mb-3">Questions to write down</p>
                        <ul className="space-y-2 text-sm text-white/80">
                          {selectedEntry.aiAnalysis.questions.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <span className="text-brandSoft font-bold">?</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  ) : null}
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Card className="rounded-[2.5rem] p-8">
          <SectionHeader
            title="30-day pattern analysis"
            titleClassName="font-['Outfit'] text-2xl font-bold"
            description={
              canViewAiInsights
                ? "Let CareCircle scan recent notes for trends, concerns, and bright spots."
                : "AI pattern analysis is reserved for caregivers and clinicians."
            }
            action={canViewAiInsights ? (
              <Button onClick={analyzePatterns} disabled={patternBusy} className="px-6">
                <Sparkles className="h-4 w-4 mr-2" />
                {patternBusy ? "Analyzing..." : "Analyze patterns"}
              </Button>
            ) : undefined}
          />
          {canViewAiInsights && patternReport ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-4 md:grid-cols-2 mt-8"
            >
              <div className="rounded-[1.5rem] bg-slate-50 border border-slate-100 p-6 shadow-sm">
                <p className="font-['Outfit'] font-bold text-textPrimary mb-3">Patterns</p>
                <ul className="space-y-2 text-sm text-textSecondary">
                  {patternReport.patterns.map((item) => (
                    <li key={item} className="flex items-start gap-2 leading-relaxed">• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[1.5rem] bg-amber-50 border border-amber-100 p-6 shadow-sm">
                <p className="font-['Outfit'] font-bold text-amber-900 mb-3">Concerns</p>
                <ul className="space-y-2 text-sm text-amber-900/70">
                  {patternReport.concerns.map((item) => (
                    <li key={item} className="flex items-start gap-2 leading-relaxed">• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[1.5rem] bg-brandSoft/40 border border-brand/10 p-6 shadow-sm">
                <p className="font-['Outfit'] font-bold text-brandDark mb-3">Doctor topics</p>
                <ul className="space-y-2 text-sm text-brandDark/70">
                  {patternReport.doctor_topics.map((item) => (
                    <li key={item} className="flex items-start gap-2 leading-relaxed">• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[1.5rem] bg-emerald-50 border border-emerald-100 p-6 shadow-sm">
                <p className="font-['Outfit'] font-bold text-emerald-800 mb-3">Positives to celebrate</p>
                <ul className="space-y-2 text-sm text-emerald-800/70">
                  {patternReport.positives.map((item) => (
                    <li key={item} className="flex items-start gap-2 leading-relaxed">• {item}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ) : canViewAiInsights ? (
            <div className="mt-8 rounded-[1.5rem] border border-dashed border-borderColor p-10 text-center text-textSecondary bg-slate-50/50 transition-colors hover:bg-slate-50">
              <Sparkles className="h-10 w-10 text-brand/30 mx-auto mb-4" />
              <p className="text-lg font-medium font-['Outfit']">Discover hidden patterns</p>
              <p className="mt-2">Tap "Analyze patterns" to see trends in plain language.</p>
            </div>
          ) : (
            <div className="mt-8 flex items-start gap-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-6 text-amber-900">
              <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-['Outfit'] font-bold text-lg">AI note analysis is restricted</p>
                <p className="mt-1 text-base text-amber-900/70 leading-relaxed">
                  Family accounts can still read shared notes, but pattern analysis stays with caregivers and clinicians for medical privacy.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={modalOpen && canLogJournal} title="New care journal entry" onClose={closeModal}>
        <form
          className="grid gap-6 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            void saveEntry();
          }}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Date">
              <Input required type="date" value={form.date} className="h-12 rounded-xl" onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            </Field>
            <Field label="Time">
              <Input type="time" value={form.time} className="h-12 rounded-xl" onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} />
            </Field>
          </div>
          <Field label="Entry title">
            <Input value={form.entryTitle} className="h-12 rounded-xl" placeholder="Leave blank and CareCircle will suggest one" onChange={(event) => setForm((current) => ({ ...current, entryTitle: event.target.value }))} />
          </Field>
          <Field label="What happened?">
            <Textarea required value={form.entryBody} className="min-h-[160px] rounded-[1.25rem] p-4" placeholder="Describe what you observed in plain words..." onChange={(event) => setForm((current) => ({ ...current, entryBody: event.target.value }))} />
          </Field>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="Mood">
              <Select value={String(form.mood)} className="h-12 rounded-xl" onChange={(event) => setForm((current) => ({ ...current, mood: Number(event.target.value) }))}>
                <option value="1">1 - Very low</option>
                <option value="2">2 - Low</option>
                <option value="3">3 - Neutral</option>
                <option value="4">4 - Better</option>
                <option value="5">5 - Good</option>
              </Select>
            </Field>
            <Field label="Pain level">
              <Input type="number" min="0" max="10" value={form.painLevel} className="h-12 rounded-xl" onChange={(event) => setForm((current) => ({ ...current, painLevel: Number(event.target.value) }))} />
            </Field>
            <Field label="Severity">
              <Select value={form.severity} className="h-12 rounded-xl" onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}>
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
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    key={tag}
                    type="button"
                    className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300 ${
                      selected ? "bg-brand text-white shadow-brand shadow-md" : "bg-slate-100 text-textSecondary border border-transparent hover:border-brand/20"
                    }`}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        tags: selected ? current.tags.filter((item) => item !== tag) : [...current.tags, tag],
                      }))
                    }
                  >
                    {tag}
                  </motion.button>
                );
              })}
            </div>
          </Field>
          <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-6 border border-slate-100">
            <div>
              <p className="font-['Outfit'] font-bold text-textPrimary text-lg">Does this need follow-up?</p>
              <p className="text-sm text-textSecondary">Turn this on if you want a reminder for the next visit.</p>
            </div>
            <Toggle checked={form.followUpNeeded} onChange={(value) => setForm((current) => ({ ...current, followUpNeeded: value }))} />
          </div>
          {form.followUpNeeded ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              key="followUp"
            >
              <Field label="Follow-up note">
                <Input
                  required={form.followUpNeeded}
                  value={form.followUpNote}
                  className="h-12 rounded-xl"
                  placeholder="Example: Mention the increased confusion at neurology"
                  onChange={(event) => setForm((current) => ({ ...current, followUpNote: event.target.value }))}
                />
              </Field>
            </motion.div>
          ) : null}
          <div className="flex justify-end gap-3 pt-6">
            <Button type="button" variant="ghost" className="px-8" onClick={closeModal} disabled={saveBusy}>Cancel</Button>
            <Button type="submit" className="px-8" disabled={saveBusy}>{saveBusy ? "Saving..." : "Save entry"}</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};
