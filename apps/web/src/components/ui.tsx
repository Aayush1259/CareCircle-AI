import { forwardRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import clsx from "clsx";
import { X } from "lucide-react";

export const cn = (...classes: Array<string | false | null | undefined>) => clsx(classes);

export const Card = forwardRef<HTMLElement, HTMLMotionProps<"section">>(function Card(
  { className, children, ...props },
  ref,
) {
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "os-shell relative w-full min-w-0 overflow-hidden p-4 transition-all duration-300 sm:p-5 lg:p-6",
        className
      )}
      {...props}
    >
      {children}
    </motion.section>
  );
});

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
      "inline-flex min-h-[42px] min-w-0 items-center justify-center gap-1.5 rounded-[0.95rem] px-3 py-2 text-center text-[0.84rem] font-bold tracking-tight leading-tight transition-all duration-300 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[46px] sm:gap-2 sm:rounded-[1.05rem] sm:px-5 sm:py-2.5 sm:text-[0.9rem] xl:min-h-[48px]",
      variant === "primary" && "border border-brandDark/10 bg-gradient-to-br from-brand via-brand to-brandDark text-white shadow-[0_18px_36px_-18px_rgba(79,70,229,0.82)] hover:-translate-y-0.5 hover:shadow-[0_24px_42px_-20px_rgba(79,70,229,0.88)]",
      variant === "secondary" && "border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(238,242,255,0.82))] text-brandDark shadow-[0_16px_32px_-20px_rgba(79,70,229,0.42)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-brand/20 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(238,242,255,0.92))]",
      variant === "ghost" && "border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.58))] text-textPrimary shadow-[0_14px_28px_-22px_rgba(15,23,42,0.3)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-slate-300/90 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.72))]",
      variant === "danger" && "border border-red-500/10 bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_14px_30px_-14px_rgba(239,68,68,0.65)] hover:-translate-y-0.5 hover:shadow-[0_20px_38px_-18px_rgba(239,68,68,0.75)]",
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
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex min-h-[22px] items-center rounded-full px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-[0.1em] leading-none ring-1 ring-inset backdrop-blur-xl sm:min-h-[26px] sm:px-3 sm:py-1.5 sm:text-[0.65rem]",
      tone === "neutral" && "bg-slate-100/90 text-slate-600 ring-slate-200/80",
      tone === "success" && "bg-emerald-100/90 text-emerald-700 ring-emerald-200/80",
      tone === "warning" && "bg-amber-100/90 text-amber-800 ring-amber-200/80",
      tone === "danger" && "bg-red-100/90 text-red-700 ring-red-200/80",
      tone === "brand" && "bg-brandSoft/90 text-brandDark ring-brand/10",
      className
    )}
  >
    {children}
  </span>
);

export const SectionHeader = ({
  title,
  description,
  action,
  className,
  titleClassName,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}) => (
  <div className={cn("mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="min-w-0 max-w-2xl">
      <h2 className={cn("text-balance font-['Outfit'] text-[1.28rem] font-bold leading-tight tracking-tight text-textPrimary sm:text-[1.6rem] xl:text-[2rem]", titleClassName)}>{title}</h2>
      {description ? <p className="mt-2 max-w-xl text-[0.84rem] font-medium leading-relaxed text-textSecondary/90 sm:mt-3 sm:text-[0.93rem]">{description}</p> : null}
    </div>
    {action ? <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">{action}</div> : null}
  </div>
);

export const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100/90 shadow-inner ring-1 ring-slate-100">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      transition={{ duration: 1, ease: "circOut" }}
      className="h-full rounded-full bg-gradient-to-r from-brand to-brandDark shadow-[0_0_18px_rgba(99,102,241,0.34)]"
    />
  </div>
);

export const Field = ({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("space-y-2.5", className)}>
    <label className="block">
      <span className="mb-2 block text-balance font-['Outfit'] text-[0.72rem] font-bold uppercase tracking-[0.18em] text-textSecondary/80 sm:mb-2.5 sm:text-[0.78rem] sm:tracking-[0.22em]">
        {label}
      </span>
      {children}
    </label>
    {hint ? <p className="text-[0.82rem] font-medium leading-relaxed text-textSecondary/85 sm:text-[0.85rem]">{hint}</p> : null}
  </div>
);

export const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "min-h-[44px] w-full min-w-0 rounded-[1.05rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.66))] px-4 py-2.5 text-[0.9rem] font-medium text-textPrimary outline-none shadow-[0_14px_26px_-22px_rgba(15,23,42,0.45)] transition-all duration-300 placeholder:text-textSecondary/45 focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/8 focus-visible:outline-none sm:min-h-[48px] sm:rounded-[1.2rem] sm:px-5 sm:py-3 sm:text-[0.96rem]",
      className,
    )}
    {...props}
  />
);

export const Textarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      "min-h-[116px] w-full min-w-0 rounded-[1.05rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.66))] px-4 py-3 text-[0.9rem] font-medium text-textPrimary outline-none shadow-[0_14px_26px_-22px_rgba(15,23,42,0.45)] transition-all duration-300 placeholder:text-textSecondary/45 focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/8 focus-visible:outline-none resize-none sm:min-h-[132px] sm:rounded-[1.2rem] sm:px-5 sm:py-3.5 sm:text-[0.96rem]",
      className,
    )}
    {...props}
  />
);

export const Select = ({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      "min-h-[44px] w-full min-w-0 cursor-pointer appearance-none rounded-[1.05rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.66))] px-4 py-2.5 text-[0.9rem] font-medium text-textPrimary outline-none shadow-[0_14px_26px_-22px_rgba(15,23,42,0.45)] transition-all duration-300 focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/8 focus-visible:outline-none sm:min-h-[48px] sm:rounded-[1.2rem] sm:px-5 sm:py-3 sm:text-[0.96rem]",
      className,
    )}
    {...props}
  />
);

export const Toggle = ({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    disabled={disabled}
    className={cn(
      "relative inline-flex h-6 w-10 shrink-0 rounded-full border border-white/70 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-brand/10 sm:h-7 sm:w-12 xl:h-8 xl:w-14",
      checked
        ? "bg-gradient-to-r from-brand via-brand to-brandDark shadow-[0_14px_24px_-16px_rgba(79,70,229,0.7)]"
        : "bg-[linear-gradient(180deg,rgba(226,232,240,0.9),rgba(203,213,225,0.9))] shadow-[inset_0_1px_2px_rgba(255,255,255,0.7)]",
      disabled && "cursor-not-allowed opacity-40"
    )}
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
  >
    <span
      className={cn(
        "absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-[0_8px_18px_-10px_rgba(15,23,42,0.45)] transition-transform duration-300 sm:h-5 sm:w-5 xl:h-6 xl:w-6",
        checked ? "translate-x-4 sm:translate-x-5 xl:translate-x-6" : "translate-x-0"
      )}
    />
  </button>
);

export const Modal = ({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <AnimatePresence>
    {open ? (
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "relative flex max-h-[calc(100svh-0.75rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.8rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.78))] shadow-[0_34px_70px_-34px_rgba(15,23,42,0.32)] backdrop-blur-2xl sm:max-h-[88vh] sm:rounded-[2.5rem]",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/80 bg-white/35 px-4 py-4 backdrop-blur-xl sm:px-8 sm:py-7">
            <h3 className="min-w-0 text-balance font-['Outfit'] text-xl font-bold text-textPrimary sm:text-2xl">{title}</h3>
            <button
              type="button"
              className="shrink-0 rounded-full p-2.5 text-textSecondary transition-colors hover:bg-white/80"
              onClick={onClose}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-4 scrollbar-thin sm:px-8 sm:py-8">
            {children}
          </div>
        </motion.div>
      </div>
    ) : null}
  </AnimatePresence>
);

export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="section-well border-2 border-dashed border-slate-200/80 text-center sm:p-12">
    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/90 shadow-sm ring-1 ring-white/80">
      <div className="h-3 w-3 rounded-full bg-slate-200 animate-pulse" />
    </div>
    <h3 className="font-['Outfit'] text-xl font-bold text-textPrimary">{title}</h3>
    <p className="mx-auto mt-3 max-w-sm text-[0.95rem] font-medium leading-relaxed text-textSecondary">{description}</p>
  </div>
);

export const LoadingState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center gap-6 p-12">
    <div className="flex gap-2">
      <motion.span
        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
        className="h-3 w-3 rounded-full bg-brand"
      />
      <motion.span
        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
        className="h-3 w-3 rounded-full bg-brand"
      />
      <motion.span
        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
        className="h-3 w-3 rounded-full bg-brand"
      />
    </div>
    <span className="font-['Outfit'] font-bold text-textSecondary uppercase tracking-widest text-xs">{message}</span>
  </div>
);
