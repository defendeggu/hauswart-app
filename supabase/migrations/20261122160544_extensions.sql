-- Benötigt für crypt()/gen_salt() (Passwort-Hashing in supabase/seed.sql).
create extension if not exists pgcrypto with schema extensions;
