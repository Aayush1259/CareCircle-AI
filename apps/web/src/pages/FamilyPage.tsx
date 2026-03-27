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
} from "lucide-react";
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
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
  { id: "overdue", title: "Overdue" },
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
    "This week, Ellie had a mostly steady medication routine, strong family support, and a few symptoms worth mentioning at the next visits.",
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
      await request("/family/messages", {
        method: "POST",
        body: JSON.stringify({ messageText: newMessage }),
      });
      const payload = await request<{ messages: FamilyMessageRecord[] }>("/family/messages");
      setFamilyMessages(payload.messages);
      setNewMessage("");
      await refresh();
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

  const taskHistory = editingTaskId
    ? bootstrap.data.activityEvents.filter((event) =>
        event.description.toLowerCase().includes(trimmedText(taskDraft.title).toLowerCase()),
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <SectionHeader
            title="Family members"
            description="Who is helping right now, what they can do, and who is still waiting on an invite."
            action={
              canManageFamily ? <Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" />Invite Member</Button> : undefined
            }
          />
          <div className="space-y-3">
            {activeMembers.map((member) => {
              const online = member.lastActive ? Date.now() - new Date(member.lastActive).getTime() < 1000 * 60 * 5 : false;
              return (
                <div key={member.id} className="flex items-center gap-3 rounded-3xl border border-borderColor p-4">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-brandSoft text-brandDark">
                    <span className="font-bold">{avatarLabel(member.name)}</span>
                    {online ? <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-success" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-textPrimary">{member.name}</p>
                    <p className="text-sm text-textSecondary">{member.relationship} | {member.permissions.replaceAll("_", " ")}</p>
                  </div>
                  <div className="text-right">
                    <Badge tone={roleTone[member.role]}>{member.role.replaceAll("_", " ")}</Badge>
                    <p className="mt-1 text-xs text-textSecondary">{online ? "Online now" : member.lastActive ? relativeTime(member.lastActive) : "Recently"}</p>
                    {canManageFamily ? (
                      <button type="button" className="mt-2 text-xs font-semibold text-red-700 hover:text-red-800" onClick={() => void removeMember(member.id)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {canManageFamily && pendingInvites.length ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-4">
              <p className="font-semibold text-textPrimary">Pending invites</p>
              <div className="mt-3 space-y-3">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-borderColor bg-white p-4">
                    <p className="font-semibold text-textPrimary">{invite.email}</p>
                    <p className="mt-1 text-sm text-textSecondary">Sent {relativeTime(invite.createdAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => void resendInvite(invite.id)}>Resend Invite</Button>
                      <Button variant="ghost" onClick={() => void cancelInvite(invite.id)}>Cancel</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="overflow-hidden bg-gradient-to-r from-brand to-brandDark text-white shadow-calm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">This week's summary</p>
          <h2 className="mt-2 text-2xl font-bold text-white">A warm recap for the whole family.</h2>
          <p className="mt-4 text-lg leading-8 text-white/90">{weeklySummary}</p>
          <Button
            variant="secondary"
            className="mt-5 bg-white text-brandDark"
            onClick={() => setWeeklySummary((current) => `${current} The team kept showing up with consistency and care.`)}
          >
            Refresh summary
          </Button>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <SectionHeader title="Shared updates feed" description="Every meaningful update in one live timeline." />
          <div className="space-y-3">
            {visibleFeed.map((event) => {
              const reactions = bootstrap.data.activityReactions.filter((reaction) => reaction.eventId === event.id);
              return (
                <div key={event.id} className="rounded-3xl border border-borderColor p-4">
                  <p className="font-semibold text-textPrimary">{event.actorName} {event.description}</p>
                  <p className="mt-1 text-sm text-textSecondary">{relativeTime(event.createdAt)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {emojiMap.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-textSecondary"
                        onClick={() => void reactToFeed(event.id, key)}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                    {reactions.map((reaction) => (
                      <Badge key={reaction.id} tone="brand">{reaction.emoji}</Badge>
                    ))}
                  </div>
                </div>
              );
            })}
            {feedCount < bootstrap.data.activityEvents.length ? (
              <Button variant="ghost" className="w-full" onClick={() => setFeedCount((current) => current + 20)}>Load More</Button>
            ) : null}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Family chat" description="A simple, warm group thread for quick updates and check-ins." />
          <div className="space-y-4">
            {pinnedMessages.length ? (
              <div className="rounded-3xl border border-borderColor p-4">
                <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setChatCollapsed((current) => !current)}>
                  <p className="font-semibold text-textPrimary">Pinned messages</p>
                  <span className="text-sm text-textSecondary">{chatCollapsed ? "Show" : "Hide"}</span>
                </button>
                {!chatCollapsed ? (
                  <div className="mt-3 space-y-3">
                    {pinnedMessages.map((message) => (
                      <div key={message.id} className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-textPrimary">{message.userName}</p>
                        <p className="mt-1 text-sm text-textSecondary">{message.messageText}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div ref={scrollRef} className="max-h-[420px] space-y-3 overflow-y-auto rounded-3xl border border-borderColor bg-slate-50 p-4">
              {familyMessages.map((message) => {
                const ownMessage = message.userId === bootstrap.viewer.id;
                return (
                  <div key={message.id} className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] rounded-3xl p-4 ${ownMessage ? "bg-brand text-white" : "bg-white text-textPrimary"}`}>
                      {!ownMessage ? <p className="text-sm font-semibold">{message.userName}</p> : null}
                      <p className="mt-1 text-sm leading-7">{message.messageText}</p>
                      <div className={`mt-2 flex items-center justify-between gap-3 text-xs ${ownMessage ? "text-white/80" : "text-textSecondary"}`}>
                        <span>{formatMessageTime(message.createdAt)}</span>
                        {canManageFamily ? (
                          <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => void pinMessage(message.id, !message.isPinned)}>
                            <Pin className="h-3.5 w-3.5" />
                            {message.isPinned ? "Unpin" : "Pin"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-3xl bg-brandSoft/55 p-4">
              <p className="font-semibold text-textPrimary">Live status</p>
              <p className="mt-1 text-sm text-textSecondary">
                Messages refresh every 30 seconds in demo mode and switch cleanly to realtime when Supabase is configured.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Textarea
                className="min-w-0 flex-1"
                value={newMessage}
                placeholder="Share an update with the family..."
                onChange={(event) => setNewMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendFamilyMessage();
                  }
                }}
              />
              <Button className="sm:self-end" onClick={() => void sendFamilyMessage()}>
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Care coordination board" description="Drag tasks between columns so everyone can see what is moving, done, or overdue." />
        <DragDropContext onDragEnd={(result) => void onDragEnd(result)}>
          <div className="grid gap-4 xl:grid-cols-4">
            {boardColumns.map((column) => {
              const items = groupedTasks[column.id];
              return (
                <div key={column.id} className="rounded-3xl bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-textPrimary">{column.title}</p>
                      <Badge tone={column.id === "overdue" ? "danger" : "neutral"}>{items.length}</Badge>
                    </div>
                    {canManageTasks ? (
                      <button
                        type="button"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-borderColor bg-white text-textSecondary hover:text-brandDark"
                        aria-label={`Add task to ${column.title}`}
                        onClick={() => openTaskEditor(undefined, column.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[220px] space-y-3 rounded-3xl transition ${snapshot.isDraggingOver ? "bg-brandSoft/50 p-2" : ""}`}
                      >
                        {items.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-borderColor bg-white/70 p-4 text-sm text-textSecondary">
                            No tasks here right now.
                          </div>
                        ) : null}

                        {items.map((task, index) => {
                          const assignedMember = activeMembers.find((member) => (member.userId ?? member.id) === task.assignedTo);
                          return (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
                                <button
                                  type="button"
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...(canManageTasks ? dragProvided.dragHandleProps : {})}
                                  onClick={() => {
                                    if (canManageTasks) {
                                      openTaskEditor(task);
                                      return;
                                    }
                                    if (canCompleteTasks && task.assignedTo === bootstrap.viewer.id && task.boardStatus !== "done") {
                                      void updateTaskStatus(task, "done");
                                    }
                                  }}
                                  className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                                    dragSnapshot.isDragging ? "border-brand shadow-lg" : task.boardStatus === "overdue" ? "border-danger/30" : "border-borderColor"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-textPrimary">{task.title}</p>
                                      <p className="mt-1 truncate text-sm text-textSecondary">{task.description || "No extra details yet."}</p>
                                    </div>
                                    <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-textSecondary">
                                    <span>{assignedMember ? assignedMember.name : "Unassigned"}</span>
                                    <span>|</span>
                                    <span>{dueLabel(task.dueDate)}</span>
                                  </div>
                                </button>
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

      <Modal open={inviteOpen} title="Invite family member" onClose={() => setInviteOpen(false)}>
        <div className="grid gap-4">
          <Field label="Name">
            <Input value={inviteForm.name} onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} />
          </Field>
          <Field label="Role">
            <Select value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value as FamilyRole }))}>
              <option value="family_member">Family member</option>
              <option value="secondary_caregiver">Helper</option>
            </Select>
          </Field>
          <Button onClick={inviteFamily}>Send Invite</Button>
        </div>
      </Modal>

      <Modal open={taskEditorOpen} title={editingTaskId ? "Task details" : "Add task"} onClose={() => setTaskEditorOpen(false)}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            void saveTask();
          }}
        >
          <Field label="Title">
            <Input required value={taskDraft.title} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))} />
          </Field>
          <Field label="Description">
            <Textarea value={taskDraft.description} onChange={(event) => setTaskDraft((current) => ({ ...current, description: event.target.value }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select value={taskDraft.category} onChange={(event) => setTaskDraft((current) => ({ ...current, category: event.target.value }))}>
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
              <Select value={taskDraft.priority} onChange={(event) => setTaskDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due date">
              <Input required type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))} />
            </Field>
            <Field label="Due time">
              <Input type="time" value={taskDraft.dueTime} onChange={(event) => setTaskDraft((current) => ({ ...current, dueTime: event.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assigned to">
              <Select value={taskDraft.assignedTo} onChange={(event) => setTaskDraft((current) => ({ ...current, assignedTo: event.target.value }))}>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.userId ?? member.id}>{member.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={taskDraft.status} onChange={(event) => setTaskDraft((current) => ({ ...current, status: event.target.value as TaskStatus }))}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="overdue">Overdue</option>
              </Select>
            </Field>
          </div>

          {editingTaskId ? (
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="font-semibold text-textPrimary">Activity log</p>
              <div className="mt-3 space-y-2 text-sm text-textSecondary">
                <p>Task created {relativeTime(bootstrap.data.tasks.find((item) => item.id === editingTaskId)?.createdAt ?? new Date().toISOString())}</p>
                {taskHistory.length ? (
                  taskHistory.slice(0, 4).map((event) => (
                    <p key={event.id}>{event.actorName} {event.description} - {relativeTime(event.createdAt)}</p>
                  ))
                ) : (
                  <p>No newer task movement has been logged yet.</p>
                )}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {editingTaskId ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const sourceTask = bootstrap.data.tasks.find((item) => item.id === editingTaskId);
                      if (sourceTask) void updateTaskStatus(sourceTask, "done");
                    }}
                  >
                    Complete
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void deleteTask(editingTaskId)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setTaskEditorOpen(false)}>Close</Button>
              <Button type="submit">{editingTaskId ? "Save changes" : "Add task"}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
