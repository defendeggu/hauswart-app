import { useAuth } from "../lib/auth";

export function HauswartHome() {
  const { profile, signOut } = useAuth();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Hallo, {profile?.name}</h1>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          Abmelden
        </button>
      </div>
      <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
        Die Erfassung von Stunden und Auslagen folgt in M2.
      </p>
    </div>
  );
}
