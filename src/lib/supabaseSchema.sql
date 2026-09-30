-- =========================================================================
-- School Bell System — Supabase PostgreSQL Schema & Realtime Setup
-- Execute this script in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =========================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create bell_sounds Table
CREATE TABLE IF NOT EXISTS public.bell_sounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    storage_path TEXT,
    format TEXT DEFAULT 'mp3',
    sound_type TEXT DEFAULT 'bell', -- 'bell' or 'announcement'
    duration_sec NUMERIC DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create bell_schedules Table
CREATE TABLE IF NOT EXISTS public.bell_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    time TEXT NOT NULL, -- Format: HH:mm (24-hour, e.g. "08:15")
    category TEXT DEFAULT 'Period',
    days_of_week JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb, -- 0=Sun, 1=Mon, ..., 6=Sat
    sound_id UUID REFERENCES public.bell_sounds(id) ON DELETE SET NULL,
    sound_name TEXT,
    sound_url TEXT,
    announcement_id UUID REFERENCES public.bell_sounds(id) ON DELETE SET NULL,
    announcement_name TEXT,
    announcement_url TEXT,
    announcement_delay_sec INTEGER NOT NULL DEFAULT 1,
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

-- 6. Insert Default Settings row if not exists
INSERT INTO public.school_settings (school_name, pa_zone, timezone, master_volume)
SELECT 'Central High School', 'Main Campus PA System', 'Africa/Accra', 0.9
WHERE NOT EXISTS (SELECT 1 FROM public.school_settings);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.bell_sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bell_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bell_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- 8. Create Open Read/Write Policies for Public/Anon Role (School Bell PA Operator)
-- (You can restrict to authenticated users if Supabase Auth is enabled)
CREATE POLICY "Allow public read access on bell_sounds" ON public.bell_sounds FOR SELECT USING (true);
CREATE POLICY "Allow public insert on bell_sounds" ON public.bell_sounds FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on bell_sounds" ON public.bell_sounds FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on bell_sounds" ON public.bell_sounds FOR DELETE USING (true);

CREATE POLICY "Allow public read access on bell_schedules" ON public.bell_schedules FOR SELECT USING (true);
CREATE POLICY "Allow public insert on bell_schedules" ON public.bell_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on bell_schedules" ON public.bell_schedules FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on bell_schedules" ON public.bell_schedules FOR DELETE USING (true);

CREATE POLICY "Allow public read access on bell_logs" ON public.bell_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on bell_logs" ON public.bell_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete on bell_logs" ON public.bell_logs FOR DELETE USING (true);

CREATE POLICY "Allow public read access on school_settings" ON public.school_settings FOR SELECT USING (true);
CREATE POLICY "Allow public update on school_settings" ON public.school_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public insert on school_settings" ON public.school_settings FOR INSERT WITH CHECK (true);

-- 9. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.bell_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bell_sounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bell_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.school_settings;

-- 10. Storage Bucket Setup
-- Create the 'bell-audio' storage bucket for audio files (.mp3, .wav, .ogg)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bell-audio', 'bell-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for bell-audio
CREATE POLICY "Public Access for Bell Audio" ON storage.objects 
FOR SELECT USING (bucket_id = 'bell-audio');

CREATE POLICY "Public Upload for Bell Audio" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'bell-audio');

CREATE POLICY "Public Delete for Bell Audio" ON storage.objects 
FOR DELETE USING (bucket_id = 'bell-audio');
