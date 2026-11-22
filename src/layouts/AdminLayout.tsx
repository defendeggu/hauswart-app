import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { linkButtonClass } from "../components/ui";

const TABS = [
  { to: "/admin", label: "Übersicht", end: true },
  { to: "/admin/eintraege", label: "Einträge" },
  { to: "/admin/familien", label: "Familien" },
  { to: "/admin/taetigkeiten", label: "Tätigkeiten" },
  { to: "/admin/logins", label: "Logins" },
];

export function AdminLayout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">
            Admin · <span className="font-normal text-slate-600">{profile?.name}</span>
          </span>
          <div className="flex items-center gap-4">
            <NavLink to="/passwort" className={linkButtonClass}>
              Passwort
            </NavLink>
            <button type="button" onClick={() => signOut()} className={linkButtonClass}>
              Abmelden
            </button>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
                  isActive
                    ? "border-teal-700 text-teal-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}
