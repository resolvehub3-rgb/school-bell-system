# School Bell & PA Broadcast Automation System

An automated school bell, timetable scheduling, and campus public address (PA) chime system engineered for real-time school operations.

Synchronized with **Ghana Standard Time (Africa/Accra — Greenwich Mean Time / GMT)** and styled with the **Montserrat** font family.

---

## Key Capabilities

1. **Two-Stage Audio Playback (Bell First, Voice Announcement Follows)**
   * **Stage 1 (Bell / Chime)**: The selected bell chime strikes first for the configured repetition count (e.g., 1x to 5x strikes with adjustable delay).
   * **Stage 2 (Voice Announcement)**: When the chime completes, the system pauses for an administrator-set delay (e.g., 1 second) and automatically plays the recorded voice announcement through the school PA speakers.

2. **Ghana Standard Time (GMT / UTC+0) Synchronization**
   * Scheduled periods, morning assemblies, lunch breaks, and dismissal bells trigger based on **Ghana Time (`Africa/Accra`)**.
   * Digital master clock and countdown display live Ghana local time.

3. **Multi-Tab Hardware Coordination**
   * Uses `BroadcastChannel` leader election to ensure that if multiple browser tabs or windows are open on the school PA computer, only the elected leader tab sends audio output to the physical amplifier, preventing overlapping chimes.

4. **Duplicate-Proof Execution Engine**
   * Every scheduled bell execution records a unique date-and-time key before playback begins, preventing duplicate chimes on page reloads or network reconnections.

5. **Direct Supabase Integration (No Fake Data)**
   * **Database**: Real PostgreSQL tables (`bell_schedules`, `bell_sounds`, `bell_logs`, `school_settings`).
   * **Storage**: Uploads custom bell chimes and voice announcements directly to Supabase Storage (`school-sounds` bucket).
   * **Realtime**: Changes to the timetable instantly sync across administrative devices.
   * **Security**: Row Level Security (RLS) enabled on all tables.

6. **Montserrat Typography**
   * Clean typography using the **Montserrat** font family alongside **JetBrains Mono** for tabular digital clock and countdown displays.

---

## Timetable & Schedule Management

* **Categories**: Period, Assembly, Break, Lunch, Dismissal, Custom.
* **Recurrence**: Active day-of-week selection (Monday through Sunday).
* **Two-Stage Sound Configuration**:
  * Step 1: Bell / Chime audio file selection.
  * Step 2: Voice Announcement audio file selection (or chime-only).
  * Chime repeat count (1x to 5x) and repeat interval (1s to 5s).
  * Pause duration between chime ringing and voice announcement (0s to 4s).
* **Enable / Disable Toggle**: Temporarily disable bells without deleting the schedule (e.g., during holidays or exams).
* **Manual Trigger**: Immediate broadcast of any period bell or chime directly from the dashboard.

---

## Sound Library

* **Audio Formats Supported**: `.mp3`, `.wav`, `.ogg`.
* **Track Categorization**:
  * `🔔 Bell Chime`: Traditional mechanical bell, acoustic chime, classic electric bell.
  * `📢 Voice Announcement`: Spoken student notices, assembly callouts, dismissal instructions.
* **In-App Audio Preview**: Listen to uploaded tracks before assigning them to schedules.
* **Default Sound**: Set a primary bell chime used by default across new schedule entries.

---

## Campus PA Hardware Setup

1. **Audio Output Line**:
   * Connect the host computer's 3.5mm headphone / line-out jack or USB audio DAC to the school PA amplifier's **AUX / LINE-IN** port.
2. **Arm PA Engine**:
   * Modern web browsers require a user interaction on the page before playing sound. Click **Arm PA Speaker** upon launching the system in the morning.
3. **Power & Sleep Management**:
   * Configure the host computer's operating system power settings to **"Never Sleep"** during active school hours (07:00 – 17:00).
4. **Volume Levels**:
   * Adjust the Master PA Volume slider in **Settings** (recommended: 75% – 90%) and set the physical amplifier gain to standard campus listening levels.

---

## Database Architecture (PostgreSQL / Supabase)

To initialize the Supabase database, execute the following SQL script in your Supabase SQL Editor:

```sql
-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create bell_sounds Table
CREATE TABLE IF NOT EXISTS public.bell_sounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sound_type TEXT NOT NULL DEFAULT 'bell', -- 'bell' or 'announcement'
    file_url TEXT NOT NULL,
    storage_path TEXT,
    format TEXT NOT NULL DEFAULT 'mp3',
    duration_sec NUMERIC DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create bell_schedules Table
CREATE TABLE IF NOT EXISTS public.bell_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    time TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Period',
    days_of_week JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
    sound_id UUID REFERENCES public.bell_sounds(id) ON DELETE SET NULL,
    sound_name TEXT,
    sound_url TEXT,
    announcement_id UUID REFERENCES public.bell_sounds(id) ON DELETE SET NULL,
    announcement_name TEXT,
    announcement_url TEXT,
    announcement_delay_sec NUMERIC NOT NULL DEFAULT 1,
    repeat_count INTEGER NOT NULL DEFAULT 1,
    repeat_interval_sec INTEGER NOT NULL DEFAULT 2,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create bell_logs Table
CREATE TABLE IF NOT EXISTS public.bell_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES public.bell_schedules(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'played', -- 'played', 'manual', 'stopped', 'failed'
    played_by TEXT DEFAULT 'PA System'
);

-- 5. Create school_settings Table
CREATE TABLE IF NOT EXISTS public.school_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_name TEXT NOT NULL DEFAULT 'Central High School',
    pa_zone TEXT NOT NULL DEFAULT 'Main Campus PA System',
    timezone TEXT NOT NULL DEFAULT 'Africa/Accra',
    default_sound_id UUID REFERENCES public.bell_sounds(id) ON DELETE SET NULL,
    master_volume NUMERIC NOT NULL DEFAULT 0.9,
    auto_arm BOOLEAN NOT NULL DEFAULT true,
    repeat_default_count INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Insert Default Settings row
INSERT INTO public.school_settings (school_name, pa_zone, timezone, master_volume)
SELECT 'Central High School', 'Main Campus PA System', 'Africa/Accra', 0.9
WHERE NOT EXISTS (SELECT 1 FROM public.school_settings);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.bell_sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bell_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bell_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on bell_sounds" ON public.bell_sounds FOR SELECT USING (true);
CREATE POLICY "Allow public write on bell_sounds" ON public.bell_sounds FOR ALL USING (true);

CREATE POLICY "Allow public read on bell_schedules" ON public.bell_schedules FOR SELECT USING (true);
CREATE POLICY "Allow public write on bell_schedules" ON public.bell_schedules FOR ALL USING (true);

CREATE POLICY "Allow public read on bell_logs" ON public.bell_logs FOR SELECT USING (true);
CREATE POLICY "Allow public write on bell_logs" ON public.bell_logs FOR ALL USING (true);

CREATE POLICY "Allow public read on school_settings" ON public.school_settings FOR SELECT USING (true);
CREATE POLICY "Allow public write on school_settings" ON public.school_settings FOR ALL USING (true);
```

---

## Environment Variables

Create `.env` using `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Technology Stack

* **Frontend**: React 18 with TypeScript, Vite
* **Styling**: Tailwind CSS, Montserrat font family, Lucide React icons
* **Audio Engine**: Web Audio API (AnalyserNode, GainNode, AudioContext)
* **Backend / Database**: Supabase PostgreSQL, Supabase Storage, Supabase Realtime
