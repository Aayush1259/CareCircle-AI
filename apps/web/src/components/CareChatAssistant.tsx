import { useMemo, useState } from "react";
import { HeartHandshake, Search, Send, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import type { ChatSessionRecord } from "@carecircle/shared";
import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { calcAge, relativeTime } from "@/lib/format";

export const CareChatAssistant = ({
  compact = false,
}: {
  compact?: boolean;
}) => {
  const { bootstrap, request, refresh } = useAppData();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(bootstrap?.data.chatSessions[0]?.id ?? null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [emotionalCheckInOpen, setEmotionalCheckInOpen] = useState(false);
  const [checkInMood, setCheckInMood] = useState("Tired but trying");
  const [checkInReply, setCheckInReply] = useState("");

  if (!bootstrap) return null;

  const { patient, data } = bootstrap;
  const sessions = useMemo(
    () =>
      data.chatSessions
        .filter((session) => session.title.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 10),
    [data.chatSessions, search],
  );
  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0];
  const messages = data.chatMessages.filter((item) => item.sessionId === selectedSession?.id);

  const sendMessage = async (content = message, sessionId = selectedSession?.id) => {
    if (!content.trim()) return;
    try {
      let nextSessionId = sessionId;
      if (!nextSessionId) {
        const created = await request<{ session: ChatSessionRecord }>("/care-chat/sessions", {
          method: "POST",
          body: JSON.stringify({ title: content.slice(0, 36) || "New conversation" }),
        });
        nextSessionId = created.session.id;
      }
      await request(`/care-chat/sessions/${nextSessionId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessage("");
      setSelectedSessionId(nextSessionId);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const suggestions = [
    "What does A1C mean from the recent lab results?",
    "Is it normal that Dad seems more confused at night?",
    "What questions should I ask at Friday's appointment?",
    "I'm feeling burnt out. What can I do this week?",
  ];

  const sendCheckIn = async () => {
    try {
      const response = await request<{ reply: string }>("/care-chat/emotional-checkin", {
        method: "POST",
        body: JSON.stringify({ feeling: checkInMood }),
      });
      setCheckInReply(response.reply);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <div className={`grid gap-4 ${compact ? "lg:grid-cols-[0.8fr,1.2fr]" : "xl:grid-cols-[0.9fr,1.1fr]"}`}>
      <div className={`space-y-4 ${compact ? "order-2 lg:order-1" : ""}`}>
        <div className="rounded-[28px] border border-borderColor bg-surface p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-textPrimary">Recent chats</p>
              <p className="text-sm text-textSecondary">Last 10 conversations stay here.</p>
            </div>
            <Button variant="secondary" onClick={() => setSelectedSessionId(null)}>New chat</Button>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
            <Input value={search} placeholder="Search chat history" className="pl-11" onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="max-h-[180px] space-y-3 overflow-y-auto pr-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className={`w-full rounded-3xl border p-4 text-left ${selectedSession?.id === session.id ? "border-brand bg-brandSoft/50" : "border-borderColor bg-white"}`}
              >
                <p className="font-semibold text-textPrimary">{session.title}</p>
                <p className="mt-1 text-sm text-textSecondary">{relativeTime(session.updatedAt)}</p>
              </button>
            ))}
          </div>
        </div>

        {!compact ? (
          <div className="rounded-[28px] bg-gradient-to-r from-brand to-brandDark p-6 text-white shadow-calm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">CareCircle</p>
                <h1 className="mt-2 text-3xl font-bold">A caring guide for your questions</h1>
                <p className="mt-3 text-white/85">
                  Supporting care for {patient.preferredName ?? patient.name}, age {calcAge(patient.dateOfBirth)}, with {patient.primaryDiagnosis} and {patient.secondaryConditions.join(", ")}.
                </p>
              </div>
              <Button variant="secondary" className="bg-white text-brandDark" onClick={() => setEmotionalCheckInOpen(true)}>
                <HeartHandshake className="h-4 w-4" />
                How are you doing?
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className={`rounded-[28px] border border-borderColor bg-surface p-4 ${compact ? "order-1 lg:order-2" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xl font-bold text-textPrimary">{selectedSession?.title ?? "New conversation"}</p>
            <p className="mt-1 text-sm text-textSecondary">Warm, short answers unless you ask for more detail.</p>
          </div>
          {compact ? (
            <Button variant="secondary" onClick={() => setEmotionalCheckInOpen(true)}>
              <HeartHandshake className="h-4 w-4" />
              Check in
            </Button>
          ) : null}
        </div>

        <div className={`mt-4 space-y-4 overflow-y-auto rounded-[28px] bg-slate-50 p-4 ${compact ? "max-h-[220px]" : "max-h-[420px]"}`}>
          {selectedSession ? (
            messages.map((item) => (
              <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-[24px] px-4 py-3 ${item.role === "user" ? "bg-brand text-white" : "bg-white text-textPrimary"}`}>
                  <p className="text-sm leading-7">{item.content}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl bg-white p-5 text-sm text-textSecondary">
              Start a new conversation. CareCircle can help with medications, documents, appointments, symptoms, and caregiver stress.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full bg-brandSoft px-4 py-2 text-left text-sm font-semibold text-brandDark"
              onClick={() => void sendMessage(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <Textarea
            value={message}
            placeholder="Ask CareCircle anything about care, medications, stress, or appointments..."
            onChange={(event) => setMessage(event.target.value)}
          />
          <Button className="self-end" onClick={() => void sendMessage()}>
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>

      <Modal open={emotionalCheckInOpen} title="How are you doing?" onClose={() => setEmotionalCheckInOpen(false)}>
        <div className="grid gap-4">
          <Field label="Your mood today">
            <Input value={checkInMood} placeholder="Example: Tired and a little overwhelmed" onChange={(event) => setCheckInMood(event.target.value)} />
          </Field>
          <Button onClick={sendCheckIn}>
            <Sparkles className="h-4 w-4" />
            Ask CareCircle
          </Button>
          {checkInReply ? (
            <div className="rounded-3xl bg-brandSoft p-5 text-textPrimary">
              {checkInReply}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};
