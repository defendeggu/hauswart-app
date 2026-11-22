import { useState, type ChangeEvent } from "react";
import { parseDecimal } from "../lib/format";

interface AmountInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

export function AmountInput({ value, onChange }: AmountInputProps) {
  const [raw, setRaw] = useState(value !== null ? String(value) : "");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setRaw(text);
    onChange(parseDecimal(text));
  }

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">Betrag in CHF</span>
      <div className="flex items-center gap-2">
        <span className="text-base font-medium text-slate-500">CHF</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={raw}
          onChange={handleChange}
          className="h-12 w-full rounded-lg border border-slate-300 px-3 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
        />
      </div>
    </label>
  );
}
