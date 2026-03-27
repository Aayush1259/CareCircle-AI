import { useMemo, useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import toast from "react-hot-toast";
import type { TaskRecord } from "@carecircle/shared";
import { Badge, Button, Card, Field, Input, Modal, SectionHeader, Select, Textarea } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";
import { hasText, trimmedText } from "@/lib/validation";

export const TasksPage = () => {
  const { bootstrap, request, refresh } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; description: string; category: string; priority: string; suggestedDueDate: string; assignedTo: string }>>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "medical",
    priority: "medium",
    dueDate: "",
    dueTime: "",
    assignedTo: "",
    recurrence: "none",
  });

  if (!bootstrap) return null;

  const today = new Date().toISOString().slice(0, 10);
  const grouped = useMemo(
    () => ({
      today: bootstrap.data.tasks.filter((task) => task.dueDate === today && task.status !== "done"),
      week: bootstrap.data.tasks.filter((task) => task.dueDate > today && task.status !== "done"),
      overdue: bootstrap.data.tasks.filter((task) => task.status === "overdue"),
    }),
    [bootstrap.data.tasks, today],
  );

  const saveTask = async () => {
    const title = trimmedText(form.title);
    const dueDate = trimmedText(form.dueDate);
    if (!hasText(title) || !hasText(dueDate)) {
      toast.error("Please enter a task title and due date before saving.");
      return;
    }

    try {
      await request("/tasks", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          title,
          description: trimmedText(form.description),
          dueDate,
          dueTime: trimmedText(form.dueTime),
          assignedTo: trimmedText(form.assignedTo),
        }),
      });
      toast.success("Task saved.");
      setModalOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const updateTask = async (task: TaskRecord, status: TaskRecord["status"]) => {
    try {
      await request(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const fetchSuggestions = async () => {
    try {
      const result = await request<{ tasks: Array<{ title: string; description: string; category: string; priority: string; suggestedDueDate: string; assignedTo: string }> }>("/tasks/suggestions", {
        method: "POST",
      });
      setSuggestions(result.tasks);
      setSuggestionsOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const addSuggestedTask = async (task: (typeof suggestions)[number]) => {
    await request("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        dueDate: task.suggestedDueDate,
        recurrence: "none",
        aiSuggested: true,
      }),
    });
    await refresh();
    setSuggestions((current) => current.filter((item) => item.title !== task.title));
    toast.success("Suggested task added.");
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeader
          title="Task overview"
          description="Urgent items first, then the week ahead."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={fetchSuggestions}>
                <Wand2 className="h-4 w-4" />
                AI task suggester
              </Button>
              <Button onClick={() => setModalOpen(true)}>Add task</Button>
            </div>
          }
        />
        <div className="grid gap-6 xl:grid-cols-3">
          {[
            { title: "Today's tasks", tasks: grouped.today, tone: "brand" as const },
            { title: "This week", tasks: grouped.week, tone: "neutral" as const },
            { title: "Overdue", tasks: grouped.overdue, tone: "danger" as const },
          ].map(({ title, tasks, tone }) => (
            <div key={title} className="rounded-3xl border border-borderColor p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-textPrimary">{title}</p>
                <Badge tone={tone}>{tasks.length}</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-3xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-textPrimary">{task.title}</p>
                      <Badge tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "neutral"}>
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-textSecondary">{task.description}</p>
                    <p className="mt-2 text-xs text-textSecondary">
                      Due {formatDate(task.dueDate)} {task.dueTime ? `at ${task.dueTime}` : ""}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="ghost" className="px-3 py-2 text-sm" onClick={() => updateTask(task, "in_progress")}>Start</Button>
                      <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => updateTask(task, "done")}>Mark complete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={modalOpen} title="Add task" onClose={() => setModalOpen(false)}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            void saveTask();
          }}
        >
          <Field label="Title">
            <Input required value={form.title} placeholder="Example: Bring dizziness notes to the doctor" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} placeholder="What exactly should happen?" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Category">
              <Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                <option value="medical">Medical</option>
                <option value="personal_care">Personal care</option>
                <option value="household">Household</option>
                <option value="administrative">Administrative</option>
                <option value="errands">Errands</option>
                <option value="emotional_support">Emotional support</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
            <Field label="Recurrence">
              <Select value={form.recurrence} onChange={(event) => setForm((current) => ({ ...current, recurrence: event.target.value }))}>
                <option value="none">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Due date">
              <Input required type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </Field>
            <Field label="Due time">
              <Input type="time" value={form.dueTime} onChange={(event) => setForm((current) => ({ ...current, dueTime: event.target.value }))} />
            </Field>
            <Field label="Assign to">
              <Select value={form.assignedTo} onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}>
                <option value="">Choose a person</option>
                {bootstrap.data.familyMembers.map((member) => (
                  <option key={member.id} value={member.userId ?? member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save task</Button>
          </div>
        </form>
      </Modal>

      <Modal open={suggestionsOpen} title="Suggested tasks to review" onClose={() => setSuggestionsOpen(false)}>
        <div className="space-y-4">
          {suggestions.map((task) => (
            <div key={task.title} className="rounded-3xl border border-borderColor p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-textPrimary">{task.title}</p>
                  <p className="mt-1 text-sm text-textSecondary">{task.description}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-textSecondary">
                    {task.category} | {task.priority}
                  </p>
                </div>
                <Sparkles className="h-5 w-5 text-brandDark" />
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => addSuggestedTask(task)}>Add</Button>
                <Button variant="ghost" onClick={() => setSuggestions((current) => current.filter((item) => item.title !== task.title))}>
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
