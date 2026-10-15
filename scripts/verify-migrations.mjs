import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const migrationDir = resolve("supabase/migrations");
const files = (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();
if (files.length === 0) throw new Error("No Supabase SQL migrations found.");

const required = [
  ["PostGIS extension", /create extension if not exists postgis/i],
  ["moderator/admin role boundaries", /create type public\.app_role as enum \('member', 'moderator', 'admin'\)/i],
  ["report row-level security", /alter table public\.reports enable row level security/i],
  ["owner-scoped report access", /author_id = \(select auth\.uid\(\)\)/i],
  ["version checked moderation", /p_expected_version[\s\S]*r\.version = p_expected_version/i],
  ["sanitized public feed", /create or replace view public\.public_reports[\s\S]*where status in \('reviewed', 'insufficient_evidence', 'closed'\)/i],
  ["private media bucket", /values \('report-private', 'report-private', false/i],
  ["no client role escalation", /revoke insert, delete on public\.user_roles from anon, authenticated/i],
  ["explicit publication consent", /public_consent boolean not null default false[\s\S]*and public_consent/i],
  ["coarsened public coordinates", /round\(extensions\.st_y\(point::extensions\.geometry\)::numeric, 4\)/i],
  ["version checked author withdrawal", /withdraw_report[\s\S]*r\.author_id = \(select auth\.uid\(\)\)[\s\S]*r\.version = p_expected_version/i],
];

const content = (await Promise.all(files.map((file) => readFile(resolve(migrationDir, file), "utf8")))).join("\n");
const failures = required.filter(([, pattern]) => !pattern.test(content)).map(([name]) => name);
if (failures.length) throw new Error(`Migration contract checks failed: ${failures.join(", ")}`);
console.log(`PASS: ${files.length} migration file(s), ${required.length} security/schema contract checks.`);
console.log("NOT VERIFIED: these static checks do not execute SQL against a configured Supabase database.");
