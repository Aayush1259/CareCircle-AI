import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { X } from "lucide-react";

export const cn = (...classes: Array<string | false | null | undefined>) => clsx(classes);

export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <motion.section
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.15 }}
    className={cn("surface-panel panel-pad", className)}
  >
    {children}
  </motion.section>
);

export const Button = ({
  className,
  variant = "primary",
  type = "button",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) => (
  <button
    type={type}
    className={cn(
      "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[0.95rem] font-semibold leading-tight transition duration-150 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60",
      variant === "primary" && "bg-brand text-white shadow-calm hover:bg-brandDark",
      variant === "secondary" && "bg-brandSoft text-brandDark shadow-sm hover:bg-brandSoft/80",
      variant === "ghost" && "border border-borderColor bg-surface text-textPrimary shadow-sm hover:bg-slate-50",
      variant === "danger" && "bg-danger text-white shadow-sm hover:bg-red-600",
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

export const Badge = ({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
}) => (
  <span
    className={cn(
      "inline-flex min-h-8 items-center rounded-full px-3 py-1.5 text-[0.82rem] font-semibold leading-none",
      tone === "neutral" && "bg-slate-100 text-slate-700",
      tone === "success" && "bg-emerald-100 text-emerald-700",
      tone === "warning" && "bg-amber-100 text-amber-800",
      tone === "danger" && "bg-red-100 text-red-700",
      tone === "brand" && "bg-brandSoft text-brandDark",
    )}
  >
    {children}
  </span>
);

export const SectionHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) => (
  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h2 className="text-xl font-bold text-textPrimary">{title}</h2>
      {description ? <p className="mt-1 text-[0.95rem] leading-7 text-textSecondary">{description}</p> : null}
    </div>
    {action ? <div className="w-full sm:w-auto sm:shrink-0">{action}</div> : null}
  </div>
);

export const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-3 w-full overflow-hidden rounded-full bg-brandSoft">
    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

export const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="field-label">{label}</span>
    {children}
    {hint ? <span className="mt-2 block text-[0.95rem] leading-7 text-textSecondary">{hint}</span> : null}
  </label>
);

export const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "min-h-12 w-full rounded-2xl border border-borderColor bg-white px-4 py-3 text-[0.95rem] text-textPrimary outline-none transition placeholder:text-textSecondary focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
      className,
    )}
    {...props}
  />
);

export const Textarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      "min-h-[120px] w-full rounded-2xl border border-borderColor bg-white px-4 py-3 text-[0.95rem] text-textPrimary outline-none transition placeholder:text-textSecondary focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
      className,
    )}
    {...props}
  />
);

export const Select = ({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      "min-h-12 w-full rounded-2xl border border-borderColor bg-white px-4 py-3 text-[0.95rem] text-textPrimary outline-none transition focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
      className,
    )}
    {...props}
  />
);

export const Toggle = ({
  checked,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  "aria-label"?: string;
}) => (
  <div className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center">
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[26px] w-[48px] rounded-full transition-all duration-[220ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        checked ? "bg-brand" : "bg-[#CBD5E1]",
      )}
      aria-pressed={checked}
      aria-label={ariaLabel}
    >
      <span
        className="absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-all duration-[220ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]"
        style={{ left: checked ? 25 : 3 }}
      />
    </button>
  </div>
);

export const Modal = ({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <AnimatePresence>
    {open ? (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[32px] bg-surface p-5 shadow-2xl sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-start justify-between gap-3 sm:items-center">
            <h3 className="text-xl font-bold text-textPrimary">{title}</h3>
            <button
              type="button"
              className="shrink-0 rounded-full p-4 text-textSecondary hover:bg-slate-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);

export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-3xl border border-dashed border-borderColor bg-slate-50 p-8 text-center">
    <h3 className="text-lg font-semibold text-textPrimary">{title}</h3>
    <p className="mt-2 text-[0.95rem] leading-7 text-textSecondary">{description}</p>
  </div>
);

export const LoadingState = ({ message }: { message: string }) => (
  <div className="surface-panel flex items-center justify-center gap-3 p-6 text-[0.95rem] text-textSecondary">
    <span className="h-3 w-3 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
    <span className="h-3 w-3 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
    <span className="h-3 w-3 animate-bounce rounded-full bg-brand" />
    <span className="font-medium">{message}</span>
  </div>
);
