import React, { useState } from 'react';
import { Database, CheckCircle2, AlertCircle, Copy, Check, ExternalLink, X, RefreshCw } from 'lucide-react';
import { getActiveSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, getSupabase } from '../lib/supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const currentConfig = getActiveSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedSchema, setCopiedSchema] = useState(false);

  if (!isOpen) return null;

  const handleVerifyConnection = async () => {
    setVerifyStatus('checking');
    setErrorMessage('');
    const sb = getSupabase();
    if (!sb) {
      setVerifyStatus('error');
      setErrorMessage('Supabase client is not initialized. Please save your URL and Anon Key first.');
      return;
    }

    try {
      const { error } = await sb.from('bell_schedules').select('id').limit(1);
      if (error) {
        if (error.code === '42P01') {
          setVerifyStatus('error');
          setErrorMessage('Connected to Supabase, but tables are missing. Please execute the SQL schema below in your Supabase SQL editor.');
        } else {
          setVerifyStatus('error');
          setErrorMessage(`Connection error: ${error.message}`);
        }
      } else {
        setVerifyStatus('success');
      }
    } catch (err: any) {
      setVerifyStatus('error');
      setErrorMessage(err.message || 'Failed to connect to Supabase.');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      alert('Please provide both Supabase Project URL and Anon Key.');
      return;
    }
    saveSupabaseConfig(url.trim(), anonKey.trim());
  };

  const handleCopySchema = () => {
    const schemaSql = `-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create bell_sounds Table
CREATE TABLE IF NOT EXISTS public.bell_sounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    storage_path TEXT,
    format TEXT DEFAULT 'mp3',
    duration_sec NUMERIC DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create bell_schedules Table
CREATE TABLE IF NOT EXISTS public.bell_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    time TEXT NOT NULL,
    category TEXT DEFAULT 'Period',
    days_of_week JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
    sound_id UUID REFERENCES public.bell_sounds(id) ON DELETE SET NULL,
    sound_name TEXT,
    sound_url TEXT,
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
    status TEXT NOT NULL DEFAULT 'played',
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

-- 7. Enable RLS
ALTER TABLE public.bell_sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bell_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bell_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on bell_sounds" ON public.bell_sounds FOR SELECT USING (true);
CREATE POLICY "Allow public insert on bell_sounds" ON public.bell_sounds FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on bell_sounds" ON public.bell_sounds FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on bell_sounds" ON public.bell_sounds FOR DELETE USING (true);

CREATE POLICY "Allow public read on bell_schedules" ON public.bell_schedules FOR SELECT USING (true);
CREATE POLICY "Allow public insert on bell_schedules" ON public.bell_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on bell_schedules" ON public.bell_schedules FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on bell_schedules" ON public.bell_schedules FOR DELETE USING (true);

CREATE POLICY "Allow public read on bell_logs" ON public.bell_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on bell_logs" ON public.bell_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on school_settings" ON public.school_settings FOR SELECT USING (true);
CREATE POLICY "Allow public update on school_settings" ON public.school_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public insert on school_settings" ON public.school_settings FOR INSERT WITH CHECK (true);

-- 8. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.bell_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bell_sounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bell_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.school_settings;

-- 9. Storage Bucket for Bell Audio files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bell-audio', 'bell-audio', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Read for Bell Audio" ON storage.objects FOR SELECT USING (bucket_id = 'bell-audio');
CREATE POLICY "Public Upload for Bell Audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'bell-audio');
CREATE POLICY "Public Delete for Bell Audio" ON storage.objects FOR DELETE USING (bucket_id = 'bell-audio');`;

    navigator.clipboard.writeText(schemaSql);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Supabase Database Connection</h3>
              <p className="text-xs text-slate-400">Real-time PostgreSQL database & storage for your school bell schedules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Connection Status */}
        <div className="my-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentConfig.url && currentConfig.anonKey ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div>
              <span className="text-xs font-semibold text-slate-300">
                {currentConfig.url && currentConfig.anonKey ? 'Credentials Configured' : 'Credentials Missing'}
              </span>
              <p className="text-xs text-slate-400 truncate max-w-sm">
                {currentConfig.url ? currentConfig.url : 'No Supabase URL connected yet.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleVerifyConnection}
              disabled={verifyStatus === 'checking' || !currentConfig.url}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifyStatus === 'checking' ? 'animate-spin' : ''}`} />
              Verify Connection
            </button>
          </div>
        </div>

        {verifyStatus === 'success' && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Successfully connected to Supabase database. Real-time sync is active.</span>
          </div>
        )}

        {verifyStatus === 'error' && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              required
              placeholder="https://xyzcompany.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Supabase Anon / Public API Key
            </label>
            <input
              type="text"
              required
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Found in your Supabase Dashboard under <strong>Project Settings → API</strong>.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            {!currentConfig.isEnv && currentConfig.url && (
              <button
                type="button"
                onClick={clearSupabaseConfig}
                className="text-xs text-rose-400 hover:text-rose-300"
              >
                Clear Saved Credentials
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors shadow-sm"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </form>

        {/* Database Migration Schema Snippet */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-300">Database SQL Schema</h4>
              <p className="text-[11px] text-slate-400">Execute once in Supabase SQL Editor to initialize all tables & realtime replication.</p>
            </div>
            <button
              onClick={handleCopySchema}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSchema ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
            </button>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400 max-h-36 overflow-y-auto">
            <code>
              {`CREATE TABLE public.bell_schedules (...)
CREATE TABLE public.bell_sounds (...)
CREATE TABLE public.bell_logs (...)
CREATE TABLE public.school_settings (...)
ALTER PUBLICATION supabase_realtime ADD TABLE ...`}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
