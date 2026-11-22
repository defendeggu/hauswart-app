import { useAuth } from "../lib/auth";

export function AdminHome() {
  const { profile, signOut } = useAuth();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Admin-Bereich – {profile?.name}</h1>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          Abmelden
        </button>
      </div>
      <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
        Übersicht, Stammdaten und Logins folgen in M3.
      </p>
    </div>
  );
}
