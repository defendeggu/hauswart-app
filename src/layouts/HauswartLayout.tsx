import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { linkButtonClass } from "../components/ui";
import { InstallHint } from "../components/InstallHint";
import { HauswartNav } from "../components/HauswartNav";

export function HauswartLayout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="text-sm font-medium text-slate-700">{profile?.name}</span>
        <div className="flex items-center gap-4">
          <Link to="/passwort" className={linkButtonClass}>
            Passwort
          </Link>
          <button type="button" onClick={() => signOut()} className={linkButtonClass}>
            Abmelden
          </button>
        </div>
      </header>

      <InstallHint />

      <div className="flex-1">
        <Outlet />
      </div>

      <HauswartNav />
    </div>
  );
}
