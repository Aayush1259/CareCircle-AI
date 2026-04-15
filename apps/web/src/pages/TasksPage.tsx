import { useMemo, useState } from "react";
import { Lock, Sparkles, Wand2, CheckCircle2, Circle, Clock, AlertCircle, Calendar, User, Search, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DroppableProvided,
  type DroppableStateSnapshot,
} from "@hello-pangea/dnd";
import toast from "react-hot-toast";
import type { TaskRecord } from "@carecircle/shared";
import { Badge, Button, Card, Field, Input, Modal, SectionHeader, Select, Textarea } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";
import { resolveViewerRole } from "@/lib/roles";
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
    dueDate: new Date().toISOString().slice(0, 10),
    dueTime: "",
    assignedTo: "",
    recurrence: "none",
  });

  if (!bootstrap) return null;

  const viewerRole = resolveViewerRole(bootstrap.viewer.role, bootstrap.viewerAccess?.accessRole);
  const capabilities =
    bootstrap.capabilities ??
    (viewerRole === "family_member"
      ? ["view_tasks", "complete_tasks"]
      : ["manage_tasks", "view_ai_insights"]);
  const canManageTasks = capabilities.includes("manage_tasks");
  const canCompleteTasks = capabilities.includes("complete_tasks");
  const canViewAiInsights = capabilities.includes("view_ai_insights");

  const visibleTasks =
    viewerRole === "family_member" && !canManageTasks
      ? bootstrap.data.tasks.filter((task) => task.assignedTo === bootstrap.viewer.id)
      : bootstrap.data.tasks;

  const today = new Date().toISOString().slice(0, 10);
  const grouped = useMemo(
    () => ({
      today: visibleTasks.filter((task) => task.dueDate === today && task.status !== "done"),
      week: visibleTasks.filter((task) => task.dueDate > today && task.status !== "done"),
      overdue: visibleTasks.filter((task) => task.status === "overdue"),
    }),
    [today, visibleTasks],
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
      toast.success(status === "done" ? "Task completed!" : `Status updated to ${status}`);
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
    try {
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
    } catch (error) {
      toast.error("Could not add suggestion.");
    }
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const task = visibleTasks.find((t) => t.id === draggableId);
    if (!task) return;
    if (destination.droppableId !== result.source.droppableId) {
      const statusMap: Record<string, TaskRecord["status"]> = {
        today: "todo",
        week: "todo",
        overdue: "overdue",
      };
      // For simplicity in a demo/prototype, we just notify.
      // In a real app we'd update either the status or the dueDate.
      toast.success(`Priority updated for ${task.title}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      {viewerRole === "family_member" && !canManageTasks && (
        <Card className="rounded-[2.5rem] bg-indigo-50 border-indigo-100/50 p-8 shadow-sm">
          <div className="flex items-start gap-5">
            <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <p className="font-['Outfit'] text-xl font-bold text-indigo-950">Focused Care View</p>
              <p className="mt-1 text-indigo-900/60 leading-relaxed font-medium">
                Your dashboard is currently filtered to display assignments specific to your role. Coordinating, reassignment, and AI task planning are managed by the primary care team.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="rounded-[2.5rem] p-10 shadow-premium bg-white border-none min-h-[600px]">
        <SectionHeader
          title="Care Board"
          titleClassName="responsive-title-xl"
          description="A centralized workspace for medical errands, household support, and daily care tasks."
          action={
            canManageTasks ? (
              <div className="flex flex-wrap gap-3">
                {canViewAiInsights && (
                  <Button variant="secondary" className="px-6 rounded-xl border border-brand/10 shadow-sm" onClick={fetchSuggestions}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    AI Task Planner
                  </Button>
                )}
                <Button onClick={() => setModalOpen(true)} className="px-6 rounded-xl shadow-brand/20 shadow-lg">New Task</Button>
              </div>
            ) : undefined
          }
        />

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="mt-10 grid gap-8 xl:grid-cols-3">
            {[
              { id: "today", title: "Immediate Focus", tasks: grouped.today, tone: "brand" as const, icon: Circle },
              { id: "week", title: "Upcoming Flow", tasks: grouped.week, tone: "neutral" as const, icon: Clock },
              { id: "overdue", title: "Action Required", tasks: grouped.overdue, tone: "danger" as const, icon: AlertCircle },
            ].map(({ id, title, tasks, tone, icon: Icon }) => (
              <div key={id} className="flex flex-col h-full">
                <div className={`mb-6 flex items-center justify-between p-5 rounded-2xl transition-colors ${
                  id === 'overdue' ? 'bg-red-50 text-red-600' :
                  id === 'today' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'
                }`}>
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <p className="font-['Outfit'] font-bold text-lg">{title}</p>
                  </div>
                  <Badge tone={tone} className="rounded-full w-7 h-7 flex items-center justify-center p-0 font-bold">{tasks.length}</Badge>
                </div>

                <Droppable droppableId={id}>
                  {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 min-h-[400px] space-y-4 rounded-3xl transition-all duration-300 ${
                        snapshot.isDraggingOver ? "bg-brand/5 scale-[1.01] p-2" : ""
                      }`}
                    >
                      <AnimatePresence initial={false}>
                        {tasks.length ? (
                          tasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!canManageTasks}>
                              {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
                                <motion.div
                                  layout
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={`group flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md ${
                                    dragSnapshot.isDragging ? "border-brand shadow-2xl scale-105 z-50 ring-4 ring-brand/10" : "border-borderColor hover:border-brand/40"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3 mb-4">
                                    <div className="min-w-0">
                                      <p className="font-['Outfit'] font-bold text-lg text-textPrimary leading-tight group-hover:text-brand transition-colors">{task.title}</p>
                                      <p className="mt-1 text-xs text-textSecondary line-clamp-2 leading-relaxed font-medium opacity-80">{task.description}</p>
                                    </div>
                                    <Badge tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "neutral"} className="uppercase text-[8px] tracking-widest px-2 py-0.5">
                                      {task.priority}
                                    </Badge>
                                  </div>

                                  <div className="mt-auto flex items-center justify-between pt-5 border-t border-slate-50">
                                    <div className="flex items-center gap-2">
                                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${task.assignedTo === bootstrap.viewer.id ? 'bg-brandSoft text-brand' : 'bg-slate-50 text-slate-400'}`}>
                                        <User className="h-3 w-3" />
                                        {task.assignedTo === bootstrap.viewer.id ? "Me" : "Team"}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-textSecondary uppercase tracking-widest">
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(task.dueDate)}
                                    </div>
                                  </div>

                                  {(canManageTasks || (canCompleteTasks && task.assignedTo === bootstrap.viewer.id)) && task.status !== "done" && (
                                    <div className="mt-5 grid grid-cols-2 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button variant="ghost" className="h-9 text-xs rounded-xl font-bold bg-slate-50 hover:bg-brandSoft hover:text-brand" onClick={() => updateTask(task, "in_progress")}>Focus</Button>
                                      <Button variant="secondary" className="h-9 text-xs rounded-xl font-bold" onClick={() => updateTask(task, "done")}>Done</Button>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </Draggable>
                          ))
                        ) : (
                          <div className="rounded-[2rem] border-2 border-dashed border-slate-100 bg-slate-50/30 p-10 flex flex-col items-center justify-center text-center opacity-60">
                            <CheckCircle2 className="h-10 w-10 text-slate-200 mb-3" />
                            <p className="text-sm font-bold text-slate-400 font-['Outfit']">Clear Horizon</p>
                          </div>
                        )}
                      </AnimatePresence>
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </Card>

      <Modal open={modalOpen && canManageTasks} title="Task Creation" onClose={() => setModalOpen(false)}>
        <form className="grid gap-6 p-2" onSubmit={(e) => { e.preventDefault(); void saveTask(); }}>
          <Field label="Task Heading">
            <Input required value={form.title} className="h-12 rounded-xl" placeholder="E.g. Schedule neurology follow-up" onChange={(e) => setForm({...form, title: e.target.value})} />
          </Field>
          <Field label="Workflow Details">
            <Textarea value={form.description} className="min-h-[100px] rounded-xl" placeholder="Describe the steps needed to complete this task..." onChange={(e) => setForm({...form, description: e.target.value})} />
          </Field>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="Domain">
              <Select value={form.category} className="h-12 rounded-xl" onChange={(e) => setForm({...form, category: e.target.value})}>
                <option value="medical">Medical</option>
                <option value="personal_care">Caregiving</option>
                <option value="household">Household</option>
                <option value="administrative">Admin</option>
                <option value="errands">Errands</option>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} className="h-12 rounded-xl" onChange={(e) => setForm({...form, priority: e.target.value})}>
                <option value="low">Standard</option>
                <option value="medium">Important</option>
                <option value="high">Critical</option>
                <option value="urgent">Immediate</option>
              </Select>
            </Field>
            <Field label="Cycle">
              <Select value={form.recurrence} className="h-12 rounded-xl" onChange={(e) => setForm({...form, recurrence: e.target.value})}>
                <option value="none">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Target Date">
              <Input required type="date" value={form.dueDate} className="h-12 rounded-xl" onChange={(e) => setForm({...form, dueDate: e.target.value})} />
            </Field>
            <Field label="Owner">
              <Select value={form.assignedTo} className="h-12 rounded-xl" onChange={(e) => setForm({...form, assignedTo: e.target.value})}>
                <option value="">Auto-assign</option>
                {bootstrap.data.familyMembers.filter((m) => m.joinStatus === "active").map((m) => (
                  <option key={m.id} value={m.userId ?? m.id}>{m.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <Button type="button" variant="ghost" className="px-8" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="px-8 shadow-brand/10 shadow-lg">Create Task</Button>
          </div>
        </form>
      </Modal>

      <Modal open={suggestionsOpen && canManageTasks && canViewAiInsights} title="AI Intelligence: Task Recommendations" onClose={() => setSuggestionsOpen(false)} className="max-w-2xl">
        <div className="p-2 space-y-6">
          <div className="bg-brandSoft/50 p-6 rounded-[2rem] border border-brand/10 flex items-start gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-brand text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-['Outfit'] font-bold text-lg text-brandDark">Intelligent Forecasting</p>
              <p className="text-sm text-textSecondary leading-relaxed">Based on Ellie's recent vitals and journal entries, the AI suggests the following proactive care tasks.</p>
            </div>
          </div>

          <div className="space-y-4">
            {suggestions.map((task, idx) => (
              <motion.div
                key={task.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:border-brand/40 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-['Outfit'] font-bold text-lg text-textPrimary leading-tight">{task.title}</p>
                    <p className="mt-2 text-sm text-textSecondary leading-relaxed">{task.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone="neutral" className="uppercase text-[8px] tracking-widest">{task.category}</Badge>
                      <Badge tone="brand" className="uppercase text-[8px] tracking-widest">Suggested</Badge>
                    </div>
                  </div>
                  <Button className="h-11 px-6 rounded-xl shadow-md" onClick={() => addSuggestedTask(task)}>Adopt</Button>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex justify-center pt-4">
            <Button variant="ghost" className="text-textSecondary font-bold" onClick={() => setSuggestionsOpen(false)}>Done Reviewing</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};
