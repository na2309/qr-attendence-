# QR Attendance Manager — setup guide

## What is included
- Student roster for your 50 students
- A permanent unique QR code for every student
- Printable ID-card sheet (browser print dialog → save as PDF or print)
- iPhone camera QR scanner
- Lecture/session tracking and duplicate-scan prevention
- Present/absent reports and CSV export
- Local offline storage and JSON backup/restore
- Optional Supabase cloud sync for using the same data on multiple devices

## 1. Put the app online (required for iPhone camera and install)
The app is a static website. Host the contents of this folder on a HTTPS host, such as GitHub Pages, Netlify, or Cloudflare Pages. Upload **the files inside this folder**, not the ZIP itself. No build command is needed.

Camera access and service workers require HTTPS (or localhost). Open the HTTPS address in **Safari** on your iPhone. While online, open the app once and allow it to finish loading so Safari can cache the app and scanner library. Then use Share → Add to Home Screen.

Offline QR scanning is available only after the scanner library has successfully cached while online. Browser/iOS storage can be cleared by iOS, so make regular backups.

## 2. Add students
On the Students tab:
- Add students one by one, or
- Import a CSV with a header row exactly like:

```csv
name,student_number
Ahmed Mohamed,2024001
Mariam Ali,2024002
```

Student numbers must be unique. Use the **Print ID cards** button to create a print sheet. In the print dialog, choose Save as PDF or a printer. Each card contains the student's name, student number and QR code.

The QR contains only a random internal ID, not the student's name or number. The app resolves that ID against its local roster.

## 3. Take attendance
1. Open Take attendance.
2. Enter a lecture name and tap Start new lecture.
3. Tap Start camera and allow camera permission.
4. Scan each printed student card.
5. The app marks a student present once per lecture. A duplicate scan is shown but not counted twice.
6. Finish lecture when done.

The app saves scans to IndexedDB on the iPhone. If offline, it continues to work locally. Export the lecture CSV or a JSON backup before clearing Safari data or moving to another phone.

## 4. Optional cloud sync with Supabase
Cloud sync is optional. Local attendance works without it. Supabase sync lets you upload data and access it on another signed-in device.

1. Create a Supabase project.
2. In Authentication → Providers, enable Email.
3. In SQL Editor, run the SQL below.
4. In the app Settings, enter the Project URL and anon/publishable key.
5. Save connection, sign in, then tap Sync now on each device.

### SQL schema and row-level security
Run this SQL in your Supabase SQL Editor:

```sql
create table if not exists public.students (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  number text not null,
  "createdAt" timestamptz not null
);
create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  "startedAt" timestamptz not null,
  "endedAt" timestamptz
);
create table if not exists public.attendance (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  "sessionId" text not null,
  "studentId" text not null,
  "studentName" text not null,
  "studentNumber" text not null,
  timestamp timestamptz not null,
  "syncedAt" timestamptz
);

alter table public.students enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;

create policy "own students" on public.students for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sessions" on public.sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own attendance" on public.attendance for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Security:** Keep the project private. Use only the anon/publishable key in the app; never put a service-role key in a browser app. The policies above restrict each signed-in account to its own records. Use a strong password and do not share your account.

### Important current limitation
The first version's Sync now uploads local records to Supabase. It does not yet download records created on another device back into the phone. For a shared multi-device roster, use the same phone as the attendance device or export/import the JSON backup. A full two-way merge can be added later.

## 5. Backups and privacy
- Keep a JSON backup in a safe place after each class day.
- The local database belongs to the browser installation on that device.
- Student names and numbers are personal information. Get appropriate permission to collect them, limit who can access the app, and avoid sharing backup files publicly.
- QR codes are identifiers, not proof that the student holding the paper is the enrolled student. For higher confidence, visually check the student or add a second verification step.

## Troubleshooting
- **Camera doesn't open:** use Safari on the HTTPS site, check iPhone Settings → Safari → Camera, and grant permission.
- **Scanner library unavailable offline:** open the app while online, wait for it to load, then reload once before going offline.
- **QR code not recognized:** confirm the student is in the roster on this device and use the card generated by this app.
- **App appears blank:** reopen the hosted HTTPS address in Safari while online.
