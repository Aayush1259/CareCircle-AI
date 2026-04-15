import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Heart,
  HeartHandshake,
  Loader2,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ChatSessionRecord } from "@carecircle/shared";
import { Button, Field, Input, Modal, cn } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { calcAge, relativeTime } from "@/lib/format";

/* ─── Types ──────────────────────────────────────────────── */
interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  isTyping?: boolean;
}

/* ─── Typing Indicator ───────────────────────────────────── */
const TypingDots = () => (
  <div className="flex items-center gap-1 px-1 py-0.5">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-2 w-2 rounded-full bg-textSecondary/50 animate-bounce"
        style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
      />
    ))}
  </div>
);

/* ─── AI Avatar ──────────────────────────────────────────── */
const AIAvatar = ({ size = "sm" }: { size?: "sm" | "md" }) => (
  <div
    className={cn(
      "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brandDark shadow-sm",
      size === "sm" ? "h-7 w-7" : "h-9 w-9",
    )}
    aria-hidden
  >
    <Heart className={cn("text-white", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} fill="currentColor" />
  </div>
);

/* ─── Message Bubble ─────────────────────────────────────── */
const MessageBubble = ({ role, content, createdAt, isTyping }: MessageBubbleProps) => {
  const [showTime, setShowTime] = useState(false);
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={cn("flex items-end gap-2", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {!isUser && <AIAvatar />}

      <div
        className={cn(
          "group relative max-w-[82%] cursor-default",
          isUser ? "items-end" : "items-start",
        )}
        onClick={() => setShowTime((v) => !v)}
      >
        <div
          className={cn(
            "px-4 py-3 text-[0.9rem] leading-[1.65] shadow-sm",
            isUser
              ? "rounded-[18px_18px_4px_18px] bg-gradient-to-br from-brand to-brandDark text-white"
              : "rounded-[18px_18px_18px_4px] border border-borderColor bg-white text-textPrimary",
          )}
        >
          {isTyping ? <TypingDots /> : content}
        </div>
        <AnimatePresence>
          {showTime && createdAt ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "mt-1 text-[0.75rem] text-textSecondary",
                isUser ? "text-right" : "text-left",
              )}
            >
              {relativeTime(createdAt)}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ─── AI Guardrail Disclaimer ─────────────────────────────── */
const AIDisclaimer = ({ compact = false }: { compact?: boolean }) => (
  <div
    className={cn(
      "mx-2 mb-3 flex items-center gap-2 border border-amber-200/50 bg-amber-50",
      compact ? "rounded-[1.15rem] px-3 py-2" : "rounded-2xl px-3 py-2",
    )}
  >
    <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
    <p className={cn("font-medium leading-tight text-amber-700", compact ? "text-[0.68rem]" : "text-[0.72rem]")}>
      AI-generated · Not a medical diagnosis · Always consult your doctor
    </p>
  </div>
);

/* ─── Main component ─────────────────────────────────────── */
export const CareChatAssistant = ({ compact = false }: { compact?: boolean }) => {
  const { bootstrap, request, refresh } = useAppData();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [emotionalCheckInOpen, setEmotionalCheckInOpen] = useState(false);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [checkInMood, setCheckInMood] = useState("Tired but trying");
  const [checkInReply, setCheckInReply] = useState("");
  const [checkInLoading, setCheckInLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSeededSessionRef = useRef(false);

  /* Auto-select first session */
  useEffect(() => {
    if (hasSeededSessionRef.current) return;
    const firstSessionId = bootstrap?.data.chatSessions[0]?.id;
    if (!firstSessionId) return;
    setSelectedSessionId(firstSessionId);
    hasSeededSessionRef.current = true;
  }, [bootstrap?.data.chatSessions]);

  /* Auto-scroll to latest message */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bootstrap?.data.chatMessages, selectedSessionId]);

  const sessions = useMemo(
    () => (bootstrap?.data.chatSessions ?? []).slice(0, 12),
    [bootstrap?.data.chatSessions],
  );

  const selectedSession = selectedSessionId
    ? sessions.find((s) => s.id === selectedSessionId) ?? null
    : null;

  const messages = useMemo(
    () =>
      (bootstrap?.data.chatMessages ?? []).filter(
        (item) => item.sessionId === selectedSession?.id,
      ),
    [bootstrap?.data.chatMessages, selectedSession?.id],
  );

  /* Auto-grow textarea */
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const sendMessage = useCallback(
    async (content = message, sessionId = selectedSession?.id) => {
      const trimmed = content.trim();
      if (!trimmed || isSending) return;
      setIsSending(true);
      try {
        let nextSessionId = sessionId;
        if (!nextSessionId) {
          const created = await request<{ session: ChatSessionRecord }>("/care-chat/sessions", {
            method: "POST",
            body: JSON.stringify({ title: trimmed.slice(0, 40) || "New conversation" }),
          });
          nextSessionId = created.session.id;
        }
        await request(`/care-chat/sessions/${nextSessionId}/messages`, {
          method: "POST",
          body: JSON.stringify({ content: trimmed }),
        });
        setMessage("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        setSelectedSessionId(nextSessionId);
        await refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Please try again.");
      } finally {
        setIsSending(false);
      }
    },
    [message, selectedSession?.id, isSending, request, refresh],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const sendCheckIn = async () => {
    if (!checkInMood.trim()) return;
    setCheckInLoading(true);
    try {
      const response = await request<{ reply: string }>("/care-chat/emotional-checkin", {
        method: "POST",
        body: JSON.stringify({ feeling: checkInMood }),
      });
      setCheckInReply(response.reply);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setCheckInLoading(false);
    }
  };

  const promptChips = useMemo(() => {
    const patient = bootstrap?.patient;
    if (!patient) return [];
    return [
      "What meds are due today?",
      `Is ${patient.preferredName ?? patient.name}'s latest vitals normal?`,
      "Prepare questions for my next appointment",
      "I'm feeling burnt out. What can I do?",
    ];
  }, [bootstrap?.patient]);

  if (!bootstrap) return null;

  const { patient } = bootstrap;

  /* ─── COMPACT MODE (inside floating panel) ─────────────── */
  if (compact) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 px-1 pb-2 sm:hidden">
          <div className="glass-chip min-w-0 flex-1 justify-start px-3 py-2 text-[0.68rem] font-semibold text-textPrimary">
            <span className="truncate">
              {patient.preferredName ?? patient.name} · {calcAge(patient.dateOfBirth)}y
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEmotionalCheckInOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] bg-brandSoft text-brandDark transition hover:bg-brandSoft/80"
            aria-label="Emotional check-in"
          >
            <HeartHandshake className="h-4 w-4" />
          </button>
        </div>

        <div className="hidden items-center gap-3 px-1 pb-3 sm:flex">
          <AIAvatar size="md" />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-none text-textPrimary">CareCircle AI</p>
            <p className="mt-0.5 truncate text-xs text-textSecondary">
              Supporting care for {patient.preferredName ?? patient.name}, {calcAge(patient.dateOfBirth)} yrs
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEmotionalCheckInOpen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-brandSoft px-3 py-1.5 text-xs font-semibold text-brandDark transition hover:bg-brandSoft/80"
            aria-label="Emotional check-in"
          >
            <HeartHandshake className="h-3.5 w-3.5" /> Check in
          </button>
        </div>

        <div className="mb-2 flex items-center gap-2 px-1 sm:hidden">
          {sessions.length > 1 ? (
            <button
              type="button"
              onClick={() => setSessionPickerOpen(true)}
              className="shrink-0 rounded-full border border-borderColor bg-white px-3 py-1.5 text-[0.68rem] font-semibold text-textPrimary transition hover:bg-slate-50"
            >
              Chats
            </button>
          ) : null}
          <div className="min-w-0 flex-1 rounded-full border border-borderColor bg-white px-3 py-1.5 text-[0.68rem] font-semibold text-textPrimary">
            <span className="block truncate">{selectedSession?.title ?? "New chat"}</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSessionId(null)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-brand/20 bg-brandSoft px-3 py-1.5 text-[0.68rem] font-semibold text-brandDark transition hover:bg-brandSoft/80"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>

        {sessions.length > 1 ? (
          <div className="mb-3 hidden gap-2 overflow-x-auto pb-1 scrollbar-hide sm:flex">
            <button
              type="button"
              onClick={() => setSelectedSessionId(null)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap",
                !selectedSessionId
                  ? "border-brand bg-brandSoft text-brandDark"
                  : "border-borderColor bg-white text-textSecondary hover:bg-slate-50",
              )}
            >
              <Plus className="h-3 w-3" /> New
            </button>
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className={cn(
                  "flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap max-w-[200px] truncate",
                  selectedSessionId === session.id
                    ? "border-brand bg-brandSoft text-brandDark"
                    : "border-borderColor bg-white text-textSecondary hover:bg-slate-50",
                )}
                title={session.title}
              >
                {session.title}
              </button>
            ))}
          </div>
        ) : null}

        <AIDisclaimer compact />

        <div className="flex-1 space-y-2.5 overflow-y-auto px-1 py-1.5 sm:space-y-3 sm:py-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-5 text-center sm:gap-5 sm:py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brandDark shadow-calm sm:h-14 sm:w-14">
                <Heart className="h-6 w-6 text-white sm:h-7 sm:w-7" fill="currentColor" />
              </div>
              <div>
                <p className="text-sm font-bold text-textPrimary">How can I help?</p>
                <p className="mt-1 text-xs text-textSecondary max-w-[260px]">
                  Ask about medications, appointments, documents, or anything about caregiving.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {promptChips.slice(0, 3).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={isSending}
                    className="max-w-[180px] truncate rounded-full border border-borderColor bg-white px-3 py-1.5 text-left text-[0.72rem] font-semibold text-textPrimary transition hover:border-brand hover:bg-brandSoft/30 disabled:opacity-60 sm:max-w-[200px] sm:text-xs"
                    onClick={() => void sendMessage(chip)}
                    title={chip}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((item) => (
              <MessageBubble
                key={item.id}
                role={item.role as "user" | "assistant"}
                content={item.content}
                createdAt={item.createdAt}
              />
            ))
          )}
          {isSending ? (
            <MessageBubble role="assistant" content="" isTyping />
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="mt-3 border-t border-borderColor pt-3">
          <div className="flex items-end gap-2 rounded-[1.35rem] border border-borderColor bg-white/92 p-2 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.28)]">
            <textarea
              ref={textareaRef}
              className="min-h-[40px] max-h-[120px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-textPrimary outline-none transition placeholder:text-textSecondary"
              placeholder="Ask CareCircle..."
              rows={1}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              disabled={!message.trim() || isSending}
              onClick={() => void sendMessage()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] bg-brand text-white shadow-calm transition hover:bg-brandDark disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <Modal open={sessionPickerOpen} title="Conversations" onClose={() => setSessionPickerOpen(false)}>
          <div className="grid gap-3">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSelectedSessionId(null);
                setSessionPickerOpen(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Start new chat
            </Button>
            <div className="grid gap-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    setSelectedSessionId(session.id);
                    setSessionPickerOpen(false);
                  }}
                  className={cn(
                    "os-shell-soft px-4 py-4 text-left",
                    selectedSessionId === session.id ? "border-brand/20 bg-brandSoft/65" : "",
                  )}
                >
                  <p className="truncate font-semibold text-textPrimary">{session.title}</p>
                  <p className="mt-1 text-xs text-textSecondary">{relativeTime(session.updatedAt)}</p>
                </button>
              ))}
            </div>
          </div>
        </Modal>

        <Modal
          open={emotionalCheckInOpen}
          title="How are you doing?"
          onClose={() => {
            setEmotionalCheckInOpen(false);
            setCheckInReply("");
          }}
        >
          <div className="grid gap-4">
            <div className="rounded-2xl bg-brandSoft/40 p-4">
              <p className="text-sm text-textSecondary leading-relaxed">
                Caregiving is hard. CareCircle is here to listen and help you feel more grounded.
                Share how you're feeling in a few words.
              </p>
            </div>
            <Field label="Your mood right now">
              <Input
                value={checkInMood}
                placeholder="e.g. Tired and a little overwhelmed"
                onChange={(e) => setCheckInMood(e.target.value)}
              />
            </Field>
            <Button onClick={sendCheckIn} disabled={checkInLoading || !checkInMood.trim()}>
              {checkInLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Ask CareCircle
            </Button>
            <AnimatePresence>
              {checkInReply ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-gradient-to-br from-brandSoft to-brandSoft/40 border border-brand/15 p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AIAvatar size="sm" />
                    <p className="text-xs font-bold text-brandDark uppercase tracking-wide">
                      CareCircle
                    </p>
                  </div>
                  <p className="text-sm leading-7 text-textPrimary">{checkInReply}</p>
                  <p className="mt-3 text-[0.72rem] text-textSecondary">
                    AI-generated · Not a medical diagnosis
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </Modal>
      </div>
    );
  }

  /* ─── FULL PAGE MODE (/care-chat route) ──────────────────── */
  return (
    <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <div className="space-y-4">
        {/* Patient context card */}
        <div className="rounded-[28px] bg-gradient-to-br from-brand to-brandDark p-5 text-white shadow-calm">
          <div className="flex items-center gap-3">
            <AIAvatar size="md" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
                CareCircle AI
              </p>
              <p className="text-lg font-extrabold">
                {patient.preferredName ?? patient.name}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed opacity-85">
            {calcAge(patient.dateOfBirth)} years old · {patient.primaryDiagnosis}
            {patient.secondaryConditions.length
              ? ` · and ${patient.secondaryConditions.join(", ")}`
              : ""}
          </p>
        </div>

        {/* Sessions list */}
        <div className="rounded-[28px] border border-borderColor bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-textPrimary">Conversations</p>
            <button
              type="button"
              onClick={() => setSelectedSessionId(null)}
              className="flex items-center gap-1 rounded-xl bg-brandSoft px-3 py-1.5 text-xs font-semibold text-brandDark transition hover:bg-brandSoft/80"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <div className="mt-3 space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-textSecondary">
                No conversations yet. Start a new one!
              </p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    selectedSession?.id === session.id
                      ? "border-brand bg-brandSoft/60"
                      : "border-borderColor bg-white hover:bg-slate-50",
                  )}
                >
                  <p className="text-sm font-semibold text-textPrimary truncate">
                    {session.title}
                  </p>
                  <p className="mt-0.5 text-xs text-textSecondary">
                    {relativeTime(session.updatedAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Emotional check-in card */}
        <div className="rounded-[28px] bg-brandSoft/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brandDark/70">
            Quick check-in
          </p>
          <h3 className="mt-2 text-xl font-bold text-textPrimary">Need a calmer moment?</h3>
          <p className="mt-2 text-sm leading-7 text-textSecondary">
            CareCircle can help with stress, confusion, and figuring out the next right step.
          </p>
          <Button className="mt-4 w-full" variant="secondary" onClick={() => setEmotionalCheckInOpen(true)}>
            <HeartHandshake className="h-4 w-4" /> Open check-in
          </Button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-col min-h-[600px] rounded-[28px] border border-borderColor bg-surface">
        {/* Chat header */}
        <div className="border-b border-borderColor px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AIAvatar size="md" />
              <div>
                <p className="text-lg font-bold text-textPrimary">
                  {selectedSession?.title ?? "New Conversation"}
                </p>
                <p className="text-xs text-textSecondary">
                  Warm answers · Under 150 words unless you need more
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => setSelectedSessionId(null)}
            >
              <Plus className="h-4 w-4" /> New chat
            </Button>
          </div>
        </div>

        <AIDisclaimer />

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brandDark shadow-calm">
                <Heart className="h-8 w-8 text-white" fill="currentColor" />
              </div>
              <div>
                <p className="text-lg font-bold text-textPrimary">Start a conversation</p>
                <p className="mt-2 text-sm text-textSecondary max-w-md">
                  CareCircle can help with medications, documents, appointments, symptoms, and caregiver stress.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {promptChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={isSending}
                    className="rounded-full border border-borderColor bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition hover:border-brand hover:bg-brandSoft/30 disabled:opacity-60"
                    onClick={() => void sendMessage(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((item) => (
              <MessageBubble
                key={item.id}
                role={item.role as "user" | "assistant"}
                content={item.content}
                createdAt={item.createdAt}
              />
            ))
          )}
          {isSending ? <MessageBubble role="assistant" content="" isTyping /> : null}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-borderColor px-6 py-4">
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-borderColor bg-white px-4 py-3 text-sm text-textPrimary outline-none transition placeholder:text-textSecondary focus:border-brand min-h-[48px] max-h-[120px]"
              placeholder="Ask CareCircle anything about care, medications, or appointments… (Enter to send, Shift+Enter for newline)"
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              disabled={!message.trim() || isSending}
              onClick={() => void sendMessage()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-calm transition hover:bg-brandDark disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[0.72rem] text-textSecondary">
            Shift+Enter for newline · CareCircle AI is not a substitute for professional medical advice
          </p>
        </div>
      </div>

      {/* Emotional check-in modal (full page version) */}
      <Modal
        open={emotionalCheckInOpen}
        title="How are you doing?"
        onClose={() => {
          setEmotionalCheckInOpen(false);
          setCheckInReply("");
        }}
      >
        <div className="grid gap-4">
          <div className="rounded-2xl bg-brandSoft/40 p-4">
            <p className="text-sm text-textSecondary leading-relaxed">
              Caregiving is genuinely hard work. CareCircle is here to listen and support you.
              Share how you're feeling in a few words.
            </p>
          </div>
          <Field label="Your mood right now">
            <Input
              value={checkInMood}
              placeholder="e.g. Exhausted but hanging in there"
              onChange={(e) => setCheckInMood(e.target.value)}
            />
          </Field>
          <Button onClick={sendCheckIn} disabled={checkInLoading || !checkInMood.trim()}>
            {checkInLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Ask CareCircle
          </Button>
          <AnimatePresence>
            {checkInReply ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-gradient-to-br from-brandSoft to-brandSoft/30 border border-brand/15 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <AIAvatar />
                  <p className="text-xs font-bold text-brandDark uppercase tracking-wide">
                    CareCircle
                  </p>
                </div>
                <p className="text-sm leading-7 text-textPrimary">{checkInReply}</p>
                <p className="mt-3 text-[0.72rem] text-textSecondary">
                  AI-generated · Not a medical diagnosis · Consult your doctor
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </Modal>
    </div>
  );
};
