import { useTheme, type Theme } from "../lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "System" },
];

export function Footer() {
  const [theme, setTheme] = useTheme();

  return (
    <footer className="mt-auto border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-400">
      <div role="radiogroup" aria-label="Darstellung" className="mb-2 inline-flex rounded-lg border border-slate-200 p-0.5">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={theme === option.value}
            onClick={() => setTheme(option.value)}
            className={`min-h-8 rounded-md px-3 font-medium transition ${
              theme === option.value ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p>
        hauswart-app v{__APP_VERSION__} · Adrian S. mit Anthropic Claude
      </p>
    </footer>
  );
}
