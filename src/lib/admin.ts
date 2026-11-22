import { supabase } from "./supabaseClient";
import type { Activity, Einheit, Entry, Period } from "./entries";
import type { Rolle } from "./auth";

export interface Family {
  id: string;
  name: string;
  aktiv: boolean;
}

export interface LoginRow {
  id: string;
  family_id: string | null;
  username: string;
  name: string;
  rolle: Rolle;
  aktiv: boolean;
}

export type AdminEntry = Entry;

const ENTRY_SELECT =
  "id, family_id, period_id, erfasst_von, datum, activity_id, dauer_h, betrag_chf, bemerkung, admin_kommentar, created_at, activities(name, einheit), periods(name, status, von, bis, stundensatz_chf)";

export async function fetchFamilies(): Promise<Family[]> {
  const { data, error } = await supabase.from("families").select("id, name, aktiv").order("name");
  if (error) throw error;
  return data as Family[];
}

export async function saveFamily(family: { id?: string; name: string; aktiv: boolean }) {
  const { error } = family.id
    ? await supabase.from("families").update({ name: family.name, aktiv: family.aktiv }).eq("id", family.id)
    : await supabase.from("families").insert({ name: family.name, aktiv: family.aktiv });
  if (error) throw error;
}

export async function fetchAllActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("id, name, aktiv, sortierung, einheit, bemerkung_pflicht, nur_familien")
    .order("sortierung");
  if (error) throw error;
  return data as Activity[];
}

export interface ActivityInput {
  id?: string;
  name: string;
  aktiv: boolean;
  sortierung: number;
  einheit: Einheit;
  bemerkung_pflicht: boolean;
  nur_familien: string[] | null;
}

export async function saveActivity({ id, ...values }: ActivityInput) {
  const { error } = id
    ? await supabase.from("activities").update(values).eq("id", id)
    : await supabase.from("activities").insert(values);
  if (error) throw error;
}

/** IDs der Tätigkeiten, zu denen schon Einträge existieren (Einheit gesperrt). */
export async function fetchActivityIdsInUse(): Promise<Set<string>> {
  const { data, error } = await supabase.from("entries").select("activity_id");
  if (error) throw error;
  return new Set((data as { activity_id: string }[]).map((row) => row.activity_id));
}

export async function fetchPeriods(): Promise<Period[]> {
  const { data, error } = await supabase
    .from("periods")
    .select("id, name, typ, von, bis, stundensatz_chf, status")
    .order("von", { ascending: false });
  if (error) throw error;
  return data as Period[];
}

export interface EntryFilter {
  familyId?: string;
  activityId?: string;
  von?: string;
  bis?: string;
  periodId?: string;
}

export async function fetchEntries(filter: EntryFilter = {}): Promise<AdminEntry[]> {
  let query = supabase.from("entries").select(ENTRY_SELECT).order("datum", { ascending: false });
  if (filter.familyId) query = query.eq("family_id", filter.familyId);
  if (filter.activityId) query = query.eq("activity_id", filter.activityId);
  if (filter.periodId) query = query.eq("period_id", filter.periodId);
  if (filter.von) query = query.gte("datum", filter.von);
  if (filter.bis) query = query.lte("datum", filter.bis);
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as AdminEntry[];
}

export async function fetchLogins(): Promise<LoginRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, family_id, username, name, rolle, aktiv")
    .order("username");
  if (error) throw error;
  return data as LoginRow[];
}

export async function setLoginActive(id: string, aktiv: boolean) {
  const { error } = await supabase.from("profiles").update({ aktiv }).eq("id", id);
  if (error) throw error;
}

export interface CreateLoginInput {
  rolle: Rolle;
  username: string;
  name: string;
  family_id?: string;
  email?: string;
  password?: string;
}

async function invokeAdminLogins<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("admin-logins", { body });
  if (error) {
    // Die Function liefert bei 4xx eine deutsche Fehlermeldung im Body.
    const context = (error as { context?: Response }).context;
    const payload = context ? await context.json().catch(() => null) : null;
    throw new Error(payload?.error ?? "Die Aktion ist fehlgeschlagen.");
  }
  return data as T;
}

export function createLogin(input: CreateLoginInput) {
  return invokeAdminLogins<{ user_id: string; username: string; password: string }>({
    action: "create",
    ...input,
  });
}

export function resetPassword(userId: string, password?: string) {
  return invokeAdminLogins<{ password: string }>({
    action: "reset_password",
    user_id: userId,
    password,
  });
}

export function resetMfa(userId: string) {
  return invokeAdminLogins<{ removed: number }>({ action: "reset_mfa", user_id: userId });
}

/** Legt laufende und nächste Periode an, falls sie fehlen (gleicher Typ, gleicher Satz). */
export async function ensurePeriods() {
  const { error } = await supabase.rpc("ensure_periods");
  if (error) throw error;
}

export async function closePeriod(periodId: string) {
  const { error } = await supabase.from("periods").update({ status: "abgeschlossen" }).eq("id", periodId);
  if (error) throw error;
}

export async function reopenPeriod(periodId: string, grund: string) {
  const { error } = await supabase.rpc("reopen_period", { p_period_id: periodId, p_grund: grund });
  if (error) throw error;
}

export async function setPeriodTyp(periodId: string, typ: Period["typ"]) {
  const { error } = await supabase.rpc("set_period_typ", { p_period_id: periodId, p_typ: typ });
  if (error) throw error;
}

export async function setStundensatz(periodId: string, stundensatzChf: number) {
  const { error } = await supabase
    .from("periods")
    .update({ stundensatz_chf: stundensatzChf })
    .eq("id", periodId);
  if (error) throw error;
}

export interface AuditRow {
  id: number;
  wer: string | null;
  wann: string;
  tabelle: string;
  zeile_id: string;
  aktion: "insert" | "update" | "delete";
  alt: Record<string, unknown> | null;
  neu: Record<string, unknown> | null;
  grund: string | null;
}

export interface AuditFilter {
  tabelle?: string;
  wer?: string;
  von?: string;
  bis?: string;
}

export async function fetchAuditLog(filter: AuditFilter = {}, limit = 200): Promise<AuditRow[]> {
  let query = supabase
    .from("audit_log")
    .select("id, wer, wann, tabelle, zeile_id, aktion, alt, neu, grund")
    .order("wann", { ascending: false })
    .limit(limit);
  if (filter.tabelle) query = query.eq("tabelle", filter.tabelle);
  if (filter.wer) query = query.eq("wer", filter.wer);
  // Tagesgrenzen in der Zeitzone des Geräts (Schweiz), nicht in UTC.
  if (filter.von) query = query.gte("wann", new Date(`${filter.von}T00:00:00`).toISOString());
  if (filter.bis) query = query.lte("wann", new Date(`${filter.bis}T23:59:59.999`).toISOString());
  const { data, error } = await query;
  if (error) throw error;
  return data as AuditRow[];
}

export async function fetchSiedlung(): Promise<string> {
  const { data, error } = await supabase.from("einstellungen").select("siedlung").maybeSingle();
  if (error) throw error;
  return (data as { siedlung: string } | null)?.siedlung ?? "";
}

export async function saveSiedlung(siedlung: string) {
  const { error } = await supabase.from("einstellungen").update({ siedlung }).eq("id", true);
  if (error) throw error;
}
