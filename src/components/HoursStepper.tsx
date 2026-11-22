import { formatHours } from "../lib/format";

const SCHNELLWAHL = [0.5, 1, 1.5, 2, 3];
const MIN = 0.25;
const MAX = 12;
const SCHRITT = 0.25;

interface HoursStepperProps {
  value: number | null;
  onChange: (value: number) => void;
}

function clamp(value: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(value / SCHRITT) * SCHRITT));
}

export function HoursStepper({ value, onChange }: HoursStepperProps) {
  const current = value ?? 0;

  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {SCHNELLWAHL.map((stunden) => (
          <button
            key={stunden}
            type="button"
            onClick={() => onChange(stunden)}
            className={`h-12 rounded-lg border text-sm font-medium transition ${
              value === stunden
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {stunden}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label="Weniger Stunden"
          onClick={() => onChange(clamp(current - SCHRITT))}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 text-xl text-slate-700 hover:bg-slate-50"
        >
          −
        </button>
        <span className="min-w-20 text-center text-lg font-semibold text-slate-900">
          {value === null ? "–" : formatHours(value)}
        </span>
        <button
          type="button"
          aria-label="Mehr Stunden"
          onClick={() => onChange(clamp(current + SCHRITT))}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 text-xl text-slate-700 hover:bg-slate-50"
        >
          +
        </button>
      </div>
    </div>
  );
}
