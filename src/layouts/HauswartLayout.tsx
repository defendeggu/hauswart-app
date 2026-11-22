import { Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { InstallHint } from "../components/InstallHint";
import { HauswartNav } from "../components/HauswartNav";

export function HauswartLayout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="text-sm font-medium text-slate-700">{profile?.name}</span>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          Abmelden
        </button>
      </header>

      <InstallHint />

      <div className="flex-1">
        <Outlet />
      </div>

      <HauswartNav />
    </div>
  );
}
