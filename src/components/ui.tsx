import type { ReactNode } from "react";

export const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";
export const textareaClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";
export const primaryButtonClass =
  "h-11 rounded-lg bg-teal-700 px-4 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass =
  "h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
export const linkButtonClass = "text-sm font-medium text-teal-700 hover:text-teal-800";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {message}
    </p>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="h-10 w-10 text-slate-400"
          >
            ✕
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
