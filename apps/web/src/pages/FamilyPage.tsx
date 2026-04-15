import { useEffect, useMemo, useRef, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult,
  type DroppableProvided,
  type DroppableStateSnapshot,
} from "@hello-pangea/dnd";
import {
  Heart,
  MessageCircleMore,
  Pin,
  Plus,
  Send,
  ThumbsUp,
  Trash2,
  UserPlus,
  Circle,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { FamilyMessageRecord, FamilyRole, TaskPriority, TaskRecord, TaskStatus } from "@carecircle/shared";
import { Badge, Button, Card, Field, Input, Modal, SectionHeader, Select, Textarea } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate, relativeTime } from "@/lib/format";
import { hasText, trimmedText } from "@/lib/validation";

const emojiMap = [
  { key: "heart", label: "Love", icon: Heart },
  { key: "thumbs", label: "Support", icon: ThumbsUp },
  { key: "thanks", label: "Thanks", icon: MessageCircleMore },
] as const;

const roleTone: Record<FamilyRole, "brand" | "neutral" | "warning"> = {
  primary_caregiver: "brand",
  secondary_caregiver: "neutral",
  family_member: "warning",
  family: "warning",
  emergency_contact: "warning",
};

const priorityTone: Record<TaskPriority, "neutral" | "warning" | "danger"> = {
  low: "neutral",
  medium: "warning",
  high: "warning",
  urgent: "danger",
};

const boardColumns = [
  { id: "todo", title: "To Do", icon: Circle },
  { id: "in_progress", title: "In Progress", icon: Clock },
  { id: "done", title: "Done", icon: CheckCircle2 },
  { id: "overdue", title: "Overdue", icon: AlertCircle },
] as const;

const emptyTaskDraft = {
  id: "",
  title: "",
  description: "",
  category: "medical",
  priority: "medium",
  dueDate: new Date().toISOString().slice(0, 10),
  dueTime: "",
  assignedTo: "",
  recurrence: "none",
  status: "todo" as TaskStatus,
};

const avatarLabel = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const dueLabel = (dueDate: string) => {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const tomorrowIso = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
  if (dueDate === todayIso) return "Today";
  if (dueDate === tomorrowIso) return "Tomorrow";
  const diffDays = Math.round((new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / 86400000);
  if (diffDays > 1 && diffDays <= 7) return `${diffDays} days`;
  return formatDate(dueDate);
};

const formatMessageTime = (date: string) =>
  new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const FamilyPage = () => {
  const { bootstrap, request, refresh } = useAppData();
  const [familyMessages, setFamilyMessages] = useState<FamilyMessageRecord[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [feedCount, setFeedCount] = useState(20);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "family_member" as FamilyRole });
  const [taskDraft, setTaskDraft] = useState(emptyTaskDraft);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [weeklySummary, setWeeklySummary] = useState(
    "A remarkably stable week for Ellie. The collective care effort across 4 family members resulted in 100% medication adherence and multiple high-quality socialization windows.",
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadMessages = async () => {
      const payload = await request<{ messages: FamilyMessageRecord[] }>("/family/messages");
      setFamilyMessages(payload.messages);
    };
    void loadMessages();
    const interval = window.setInterval(() => void loadMessages(), 30000);
    return () => window.clearInterval(interval);
  }, [request]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [familyMessages]);

  if (!bootstrap) return null;

  const canManageFamily = bootstrap.capabilities.includes("manage_family");
  const canManageTasks = bootstrap.capabilities.includes("manage_tasks");
  const canCompleteTasks = bootstrap.capabilities.includes("complete_tasks");
  const pendingInvites = bootstrap.data.familyMembers.filter((member) => member.joinStatus === "pending");
  const activeMembers = bootstrap.data.familyMembers.filter((member) => member.joinStatus !== "pending");
  const pinnedMessages = familyMessages.filter((message) => message.isPinned);
  const visibleFeed = bootstrap.data.activityEvents.slice(0, feedCount);
  const todayIso = new Date().toISOString().slice(0, 10);

  const tasksWithBoardStatus = bootstrap.data.tasks.map((task) => {
    const isOverdue = task.status !== "done" && task.dueDate < todayIso;
    return {
      ...task,
      boardStatus: (isOverdue ? "overdue" : task.status) as TaskStatus,
    };
  });

  const groupedTasks = {
    todo: tasksWithBoardStatus.filter((task) => task.boardStatus === "todo"),
    in_progress: tasksWithBoardStatus.filter((task) => task.boardStatus === "in_progress"),
    done: tasksWithBoardStatus.filter((task) => task.boardStatus === "done"),
    overdue: tasksWithBoardStatus.filter((task) => task.boardStatus === "overdue"),
  };

  const sendFamilyMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      const payload = await request<{ message: FamilyMessageRecord }>("/family/messages", {
        method: "POST",
        body: JSON.stringify({ messageText: newMessage }),
      });
      setFamilyMessages((current) => [...current, payload.message]);
      setNewMessage("");
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const inviteFamily = async () => {
    try {
      await request("/family/invite", {
        method: "POST",
        body: JSON.stringify(inviteForm),
      });
      toast.success("Invite sent.");
      setInviteOpen(false);
      setInviteForm({ name: "", email: "", role: "family_member" });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const resendInvite = async (inviteId: string) => {
    try {
      await request(`/family/invite/${inviteId}/resend`, { method: "POST" });
      toast.success("Invite resent.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const cancelInvite = async (inviteId: string) => {
    try {
      await request(`/family/invite/${inviteId}`, { method: "DELETE" });
      toast.success("Invite cancelled.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const removeMember = async (memberId: string) => {
    if (!window.confirm("Remove this family member from CareCircle?")) return;
    try {
      await request(`/family/members/${memberId}`, { method: "DELETE" });
      toast.success("Family member removed.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const reactToFeed = async (eventId: string, emoji: string) => {
    try {
      await request(`/family/feed/${eventId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const pinMessage = async (messageId: string, isPinned: boolean) => {
    try {
      await request(`/family/messages/${messageId}/pin`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned }),
      });
      const payload = await request<{ messages: FamilyMessageRecord[] }>("/family/messages");
      setFamilyMessages(payload.messages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const openTaskEditor = (task?: TaskRecord, defaultStatus: TaskStatus = "todo") => {
    if (task) {
      setEditingTaskId(task.id);
      setTaskDraft({
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        dueDate: task.dueDate,
        dueTime: task.dueTime ?? "",
        assignedTo: task.assignedTo,
        recurrence: task.recurrence,
        status: task.status,
      });
    } else {
      setEditingTaskId(null);
      setTaskDraft({
        ...emptyTaskDraft,
        assignedTo: activeMembers[0]?.userId ?? activeMembers[0]?.id ?? bootstrap.viewer.id,
        status: defaultStatus,
      });
    }
    setTaskEditorOpen(true);
  };

  const saveTask = async () => {
    const payload = {
      title: trimmedText(taskDraft.title),
      description: trimmedText(taskDraft.description),
      category: taskDraft.category,
      priority: taskDraft.priority,
      dueDate: trimmedText(taskDraft.dueDate),
      dueTime: trimmedText(taskDraft.dueTime),
      assignedTo: trimmedText(taskDraft.assignedTo),
      recurrence: taskDraft.recurrence,
      status: taskDraft.status,
    };
    if (!hasText(payload.title) || !hasText(payload.dueDate)) {
      toast.error("Please enter a task title and due date before saving.");
      return;
    }
    try {
      if (editingTaskId) {
        await request(`/tasks/${editingTaskId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Task updated.");
      } else {
        await request("/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Task added.");
      }
      setTaskEditorOpen(false);
      setEditingTaskId(null);
      setTaskDraft(emptyTaskDraft);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const updateTaskStatus = async (task: TaskRecord, status: TaskStatus) => {
    try {
      await request(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(status === "done" ? "Task completed." : `Moved to ${status.replaceAll("_", " ")}.`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!window.confirm("Delete this task from the board?")) return;
    try {
      await request(`/tasks/${taskId}`, { method: "DELETE" });
      toast.success("Task deleted.");
      setTaskEditorOpen(false);
      setEditingTaskId(null);
      setTaskDraft(emptyTaskDraft);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!canManageTasks) return;
    if (!result.destination) return;
    const sourceId = result.source.droppableId as TaskStatus;
    const destinationId = result.destination.droppableId as TaskStatus;
    if (sourceId === destinationId && result.source.index === result.destination.index) return;
    const task = groupedTasks[sourceId]?.[result.source.index];
    if (!task) return;
    await updateTaskStatus(task, destinationId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-10"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="rounded-[2.5rem] p-10 shadow-premium bg-white border-none">
          <SectionHeader
            title="Care Circle"
            titleClassName="responsive-title-xl"
            description="Invite family and specialists to the unified care plan. Manage permissions and check recent activity."
            action={
              canManageFamily ? <Button onClick={() => setInviteOpen(true)} className="px-6 py-4 rounded-xl"><UserPlus className="h-4 w-4 mr-2" />Invite Member</Button> : undefined
            }
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {activeMembers.map((member, idx) => {
              const online = member.lastActive ? Date.now() - new Date(member.lastActive).getTime() < 1000 * 60 * 5 : false;
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group flex items-center gap-5 rounded-[2rem] border border-borderColor bg-white p-5 transition-all duration-300 hover:border-brand hover:shadow-md"
                >
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brandSoft/40 text-brand shadow-inner">
                    <span className="font-['Outfit'] text-2xl font-bold">{avatarLabel(member.name)}</span>
                    {online ? <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-4 border-white bg-success animate-pulse" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-['Outfit'] text-xl font-bold text-textPrimary truncate">{member.name}</p>
                    <p className="text-sm text-textSecondary font-medium">{member.relationship}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge tone={roleTone[member.role]} className="px-3 py-0.5 text-[10px]">{member.role.replaceAll("_", " ")}</Badge>
                      <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest">{online ? "Active" : relativeTime(member.lastActive)}</span>
                    </div>
                  </div>
                  {canManageFamily && (
                    <button type="button" className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-xl text-red-600" onClick={() => void removeMember(member.id)}>
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>

          {canManageFamily && pendingInvites.length > 0 && (
            <div className="mt-10 p-8 rounded-[2rem] bg-slate-50 border border-slate-100/50">
              <p className="font-['Outfit'] text-xl font-bold text-textPrimary mb-6 flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand" />
                Outgoing Invitations
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-borderColor bg-white p-5 shadow-sm">
                    <p className="font-bold text-textPrimary text-lg">{invite.name || invite.email}</p>
                    <p className="mt-1 text-sm text-textSecondary tracking-tight">{invite.email}</p>
                    <div className="mt-4 flex gap-2">
                      <Button variant="secondary" className="text-xs h-9 px-4 rounded-lg" onClick={() => void resendInvite(invite.id)}>Resend</Button>
                      <Button variant="ghost" className="text-xs h-9 px-4 rounded-lg" onClick={() => void cancelInvite(invite.id)}>Cancel</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="rounded-[2.5rem] bg-gradient-to-br from-brand via-brandDark to-brand/90 p-10 text-white shadow-premium relative overflow-hidden flex flex-col justify-center">
          <div className="relative z-10">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-white/70 mb-6">AI Unified Briefing</p>
            <h2 className="responsive-title-xl leading-tight">Collective impact this week.</h2>
            <p className="mt-8 text-xl leading-relaxed text-white/85 font-medium italic border-l-4 border-white/20 pl-6">
              "{weeklySummary}"
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1 min-w-[120px] border border-white/10">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Active Helpers</p>
                <p className="text-2xl font-bold mt-1">4</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1 min-w-[120px] border border-white/10">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Tasks Done</p>
                <p className="text-2xl font-bold mt-1">12</p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="mt-10 bg-white text-brandDark hover:bg-slate-50 px-8 py-6 rounded-2xl shadow-lg"
              onClick={() => setWeeklySummary("Every medication dose was logged, 3 visits were prepped, and Ellie felt consistently supported. A perfect week for the Care Circle.")}
            >
              Refresh Insights
            </Button>
          </div>
          <Heart className="absolute -right-12 -bottom-12 h-64 w-64 text-white/5 rotate-12" />
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[2.5rem] p-10 shadow-calm">
          <SectionHeader
            title="Shared Feed"
            titleClassName="responsive-title-lg"
            description="Tap a reaction to show support for care team actions."
          />
          <div className="mt-8 space-y-4">
            {visibleFeed.map((event, idx) => {
              const reactions = bootstrap.data.activityReactions.filter((reaction) => reaction.eventId === event.id);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group rounded-3xl border border-borderColor bg-white p-6 transition-all hover:border-brand/30 hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs">
                      {event.actorName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-medium text-textPrimary leading-tight">
                        <span className="font-['Outfit'] font-bold text-brand">{event.actorName}</span> {event.description}
                      </p>
                      <p className="mt-1 text-xs font-bold text-textSecondary uppercase tracking-widest">{relativeTime(event.createdAt)}</p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {emojiMap.map(({ key, label, icon: Icon }) => (
                          <button
                            key={key}
                            type="button"
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-50 hover:bg-brandSoft/30 px-3.5 py-1.5 text-xs font-bold text-textSecondary transition-colors border border-slate-100"
                            onClick={() => void reactToFeed(event.id, key)}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                          </button>
                        ))}
                        {reactions.map((reaction) => (
                          <Badge key={reaction.id} tone="brand" className="px-3 rounded-xl">{reaction.emoji}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {feedCount < bootstrap.data.activityEvents.length && (
              <Button variant="ghost" className="w-full py-4 font-bold text-brand" onClick={() => setFeedCount(curr => curr + 20)}>Load Earlier Activity</Button>
            )}
          </div>
        </Card>

        <Card className="rounded-[2.5rem] p-10 flex flex-col shadow-calm bg-slate-50/50 border-slate-100">
          <SectionHeader
            title="Team Hub"
            titleClassName="responsive-title-lg"
            description="Warm group communication for the family."
          />
          <div className="mt-8 flex-1 flex flex-col min-h-[500px]">
            <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              <AnimatePresence mode="popLayout">
                {familyMessages.map((message, idx) => {
                  const ownMessage = message.userId === bootstrap.viewer.id;
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[85%] relative ${ownMessage ? "" : "pl-11"}`}>
                        {!ownMessage && (
                          <div className="absolute left-0 top-0 h-8 w-8 rounded-full bg-brandSoft text-brand font-bold text-[10px] flex items-center justify-center">
                            {avatarLabel(message.userName)}
                          </div>
                        )}
                        <div className={`rounded-2xl px-5 py-4 shadow-sm ${ownMessage ? "bg-brand text-white rounded-tr-none" : "bg-white text-textPrimary rounded-tl-none border border-borderColor"}`}>
                          {!ownMessage && <p className="text-[10px] font-bold uppercase tracking-widest text-brandDark/60 mb-1">{message.userName}</p>}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.messageText}</p>
                          <div className={`mt-2 flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest ${ownMessage ? "text-white/60" : "text-textSecondary"}`}>
                            <span>{formatMessageTime(message.createdAt)}</span>
                            {message.isPinned && <Pin className="h-3 w-3 fill-current" />}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="mt-8 space-y-4">
              <div className="relative">
                <Textarea
                  className="min-h-[100px] w-full rounded-2xl p-5 pr-14 bg-white shadow-inner border-slate-200 focus:border-brand resize-none"
                  value={newMessage}
                  placeholder="Type a message to the group..."
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendFamilyMessage();
                    }
                  }}
                />
                <button
                  className="absolute right-4 bottom-4 h-11 w-11 rounded-xl bg-brand text-white flex items-center justify-center shadow-brand/20 shadow-lg hover:bg-brandDark transition-colors"
                  onClick={() => void sendFamilyMessage()}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-[2.5rem] p-10 bg-slate-50 border-none">
        <SectionHeader
          title="Coordination Board"
          titleClassName="responsive-title-lg"
          description="Drag tasks to update everyone on what's moving. High-priority items are flagged automatically."
          action={canManageTasks && <Button onClick={() => openTaskEditor()} className="rounded-xl"><Plus className="h-4 w-4 mr-2" />New Board Task</Button>}
        />
        <DragDropContext onDragEnd={(result) => void onDragEnd(result)}>
          <div className="mt-10 grid gap-8 xl:grid-cols-4">
            {boardColumns.map((column) => {
              const items = groupedTasks[column.id];
              const ColumnIcon = column.icon;
              return (
                <div key={column.id} className="flex flex-col h-full">
                  <div className={`mb-6 flex items-center justify-between p-4 rounded-2xl ${
                    column.id === 'overdue' ? 'bg-red-50 text-red-600' :
                    column.id === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-textPrimary shadow-sm'
                  }`}>
                    <div className="flex items-center gap-3">
                      <ColumnIcon className="h-5 w-5" />
                      <p className="font-['Outfit'] font-bold">{column.title}</p>
                    </div>
                    <Badge tone={column.id === "overdue" ? "danger" : "neutral"} className="rounded-full w-6 h-6 flex items-center justify-center p-0">{items.length}</Badge>
                  </div>

                  <Droppable droppableId={column.id} isDropDisabled={!canManageTasks}>
                    {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 min-h-[400px] space-y-4 rounded-3xl transition-all duration-300 ${snapshot.isDraggingOver ? "bg-brand/5 scale-[1.02] p-2" : ""}`}
                      >
                        {items.map((task, index) => {
                          const assignedMember = activeMembers.find((m) => (m.userId ?? m.id) === task.assignedTo);
                          return (
                            <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!canManageTasks}>
                              {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...(canManageTasks ? dragProvided.dragHandleProps : {})}
                                  onClick={() => canManageTasks && openTaskEditor(task)}
                                  className={`group flex flex-col rounded-2xl border bg-white p-5 text-left shadow-sm transition-all duration-300 hover:shadow-md ${
                                    dragSnapshot.isDragging ? "border-brand shadow-2xl scale-105" :
                                    task.boardStatus === "overdue" ? "border-red-100" : "border-borderColor"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0">
                                      <p className="font-['Outfit'] font-bold text-textPrimary leading-tight group-hover:text-brand transition-colors">{task.title}</p>
                                      <p className="mt-1 text-xs text-textSecondary line-clamp-2">{task.description}</p>
                                    </div>
                                    <Badge tone={priorityTone[task.priority]} className="uppercase text-[8px] tracking-widest">{task.priority}</Badge>
                                  </div>
                                  <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                                        {assignedMember ? avatarLabel(assignedMember.name) : "?"}
                                      </div>
                                      <span className="text-[10px] font-bold text-textSecondary uppercase">{assignedMember ? assignedMember.name.split(' ')[0] : "Open"}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${task.boardStatus === 'overdue' ? 'text-red-600' : 'text-textSecondary'}`}>
                                      {dueLabel(task.dueDate)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </Card>

      <Modal open={inviteOpen} title="Expand Care Team" onClose={() => setInviteOpen(false)}>
        <form className="grid gap-6 p-2" onSubmit={(e) => { e.preventDefault(); void inviteFamily(); }}>
          <Field label="Full Name">
            <Input required value={inviteForm.name} className="h-12 rounded-xl" placeholder="E.g. David Smith" onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})} />
          </Field>
          <Field label="Email Address">
            <Input required type="email" value={inviteForm.email} className="h-12 rounded-xl" placeholder="david@example.com" onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} />
          </Field>
          <Field label="Team Role">
            <Select value={inviteForm.role} className="h-12 rounded-xl" onChange={(e) => setInviteForm({...inviteForm, role: e.target.value as any})}>
              <option value="family_member">Family Participant</option>
              <option value="secondary_caregiver">Active Helper</option>
              <option value="primary_caregiver">Co-Caregiver</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" className="px-8" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button type="submit" className="px-8 shadow-brand/10 shadow-lg">Send Invitation</Button>
          </div>
        </form>
      </Modal>

      <Modal open={taskEditorOpen} title={editingTaskId ? "Task Configuration" : "New Care Task"} onClose={() => setTaskEditorOpen(false)}>
        <form className="grid gap-6 p-2" onSubmit={(e) => { e.preventDefault(); void saveTask(); }}>
          <Field label="Task Heading">
            <Input required value={taskDraft.title} className="h-12 rounded-xl" placeholder="E.g. Refill daily pill organizer" onChange={(e) => setTaskDraft({...taskDraft, title: e.target.value})} />
          </Field>
          <Field label="Execution Details">
            <Textarea value={taskDraft.description} className="min-h-[100px] rounded-xl" placeholder="Provide step-by-step instructions if needed..." onChange={(e) => setTaskDraft({...taskDraft, description: e.target.value})} />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Care Stream">
              <Select value={taskDraft.category} className="h-12 rounded-xl" onChange={(e) => setTaskDraft({...taskDraft, category: e.target.value})}>
                <option value="medical">Medical</option>
                <option value="personal_care">Personal Care</option>
                <option value="household">Household</option>
                <option value="administrative">Admin</option>
                <option value="errands">Errands</option>
                <option value="emotional_support">Wellbeing</option>
              </Select>
            </Field>
            <Field label="Priority Level">
              <Select value={taskDraft.priority} className="h-12 rounded-xl" onChange={(e) => setTaskDraft({...taskDraft, priority: e.target.value as any})}>
                <option value="low">Standard</option>
                <option value="medium">Important</option>
                <option value="high">Critical</option>
                <option value="urgent">Immediate Action</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Deadline Date">
              <Input required type="date" value={taskDraft.dueDate} className="h-12 rounded-xl" onChange={(e) => setTaskDraft({...taskDraft, dueDate: e.target.value})} />
            </Field>
            <Field label="Owner">
              <Select value={taskDraft.assignedTo} className="h-12 rounded-xl" onChange={(e) => setTaskDraft({...taskDraft, assignedTo: e.target.value})}>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.userId ?? m.id}>{m.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-between items-center pt-8 border-t border-slate-100">
            {editingTaskId ? (
              <Button type="button" variant="ghost" className="text-red-500 hover:bg-red-50 px-6 rounded-xl" onClick={() => void deleteTask(editingTaskId)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Task
              </Button>
            ) : <div />}
            <div className="flex gap-3">
              <Button type="button" variant="ghost" className="px-8" onClick={() => setTaskEditorOpen(false)}>Cancel</Button>
              <Button type="submit" className="px-8 shadow-brand/10 shadow-lg">Save Task</Button>
            </div>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};
