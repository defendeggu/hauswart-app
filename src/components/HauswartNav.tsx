import { NavLink } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex h-14 flex-1 items-center justify-center text-sm font-medium ${
    isActive ? "text-teal-700" : "text-slate-500"
  }`;

export function HauswartNav() {
  return (
    <nav className="sticky bottom-0 flex border-t border-slate-200 bg-white">
      <NavLink to="/erfassen" className={tabClass}>
        Erfassen
      </NavLink>
      <NavLink to="/eintraege" className={tabClass}>
        Meine Einträge
      </NavLink>
    </nav>
  );
}
