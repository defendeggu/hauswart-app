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
