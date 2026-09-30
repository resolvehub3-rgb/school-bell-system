import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BellSchedule, BellSound, BellLog, SchoolSettings } from '../types/bell';

// Resolve configuration from environment variables or custom storage
const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const storedUrl = typeof window !== 'undefined' ? (localStorage.getItem('SCHOOL_BELL_SUPABASE_URL') || '').trim() : '';
const storedKey = typeof window !== 'undefined' ? (localStorage.getItem('SCHOOL_BELL_SUPABASE_ANON_KEY') || '').trim() : '';

const activeUrl = envUrl || storedUrl;
const activeKey = envKey || storedKey;

let supabaseInstance: SupabaseClient | null = null;

if (activeUrl && activeKey) {
  try {
    supabaseInstance = createClient(activeUrl, activeKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}

export const getSupabase = (): SupabaseClient | null => supabaseInstance;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(activeUrl && activeKey && supabaseInstance);
};

export const getActiveSupabaseConfig = () => {
  return {
    url: activeUrl,
    anonKey: activeKey,
    isEnv: Boolean(envUrl && envKey),
  };
};

export const saveSupabaseConfig = (url: string, anonKey: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('SCHOOL_BELL_SUPABASE_URL', url.trim());
    localStorage.setItem('SCHOOL_BELL_SUPABASE_ANON_KEY', anonKey.trim());
    window.location.reload();
  }
};

export const clearSupabaseConfig = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('SCHOOL_BELL_SUPABASE_URL');
    localStorage.removeItem('SCHOOL_BELL_SUPABASE_ANON_KEY');
    window.location.reload();
  }
};

// -------------------------------------------------------------
// Real Supabase API Operations
// -------------------------------------------------------------

export async function fetchSchedulesApi(): Promise<BellSchedule[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('bell_schedules')
    .select('*')
    .order('time', { ascending: true });

  if (error) {
    console.error('Error fetching schedules from Supabase:', error.message);
    throw error;
  }

  return (data || []).map((row: any) => ({
    ...row,
    days_of_week: Array.isArray(row.days_of_week)
      ? row.days_of_week
      : typeof row.days_of_week === 'string'
      ? JSON.parse(row.days_of_week)
      : [1, 2, 3, 4, 5],
  }));
}

export async function createScheduleApi(schedule: Omit<BellSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<BellSchedule> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');

  const { data, error } = await sb
    .from('bell_schedules')
    .insert([
      {
        name: schedule.name,
        time: schedule.time,
        category: schedule.category,
        days_of_week: schedule.days_of_week,
        sound_id: schedule.sound_id || null,
        sound_name: schedule.sound_name || null,
        sound_url: schedule.sound_url || null,
        announcement_id: schedule.announcement_id || null,
        announcement_name: schedule.announcement_name || null,
        announcement_url: schedule.announcement_url || null,
        announcement_delay_sec: schedule.announcement_delay_sec || 1,
        repeat_count: schedule.repeat_count || 1,
        repeat_interval_sec: schedule.repeat_interval_sec || 2,
        is_enabled: schedule.is_enabled,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating schedule in Supabase:', error.message);
    throw error;
  }

  return {
    ...data,
    days_of_week: Array.isArray(data.days_of_week)
      ? data.days_of_week
      : typeof data.days_of_week === 'string'
      ? JSON.parse(data.days_of_week)
      : [1, 2, 3, 4, 5],
  };
}

export async function updateScheduleApi(id: string, updates: Partial<BellSchedule>): Promise<BellSchedule> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');

  const payload: any = { ...updates, updated_at: new Date().toISOString() };
  if ('id' in payload) delete payload.id;
  if ('created_at' in payload) delete payload.created_at;

  const { data, error } = await sb
    .from('bell_schedules')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating schedule in Supabase:', error.message);
    throw error;
  }

  return {
    ...data,
    days_of_week: Array.isArray(data.days_of_week)
      ? data.days_of_week
      : typeof data.days_of_week === 'string'
      ? JSON.parse(data.days_of_week)
      : [1, 2, 3, 4, 5],
  };
}

export async function deleteScheduleApi(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');

  const { error } = await sb.from('bell_schedules').delete().eq('id', id);
  if (error) {
    console.error('Error deleting schedule in Supabase:', error.message);
    throw error;
  }
}

// -------------------------------------------------------------
// Sounds API
// -------------------------------------------------------------

export async function fetchSoundsApi(): Promise<BellSound[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('bell_sounds')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sounds from Supabase:', error.message);
    throw error;
  }

  return data || [];
}

export async function uploadSoundFileApi(file: File): Promise<{ fileUrl: string; storagePath: string }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');

  const fileExt = file.name.split('.').pop() || 'mp3';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error: uploadError } = await sb.storage.from('bell-audio').upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'audio/mpeg',
  });

  if (uploadError) {
    console.error('Error uploading sound to Supabase Storage:', uploadError.message);
    throw uploadError;
  }

  const { data: urlData } = sb.storage.from('bell-audio').getPublicUrl(filePath);

  return {
    fileUrl: urlData.publicUrl,
    storagePath: filePath,
  };
}

export async function createSoundApi(sound: Omit<BellSound, 'id' | 'created_at'>): Promise<BellSound> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');

  const { data, error } = await sb
    .from('bell_sounds')
    .insert([
      {
        name: sound.name,
        file_url: sound.file_url,
        storage_path: sound.storage_path || null,
        format: sound.format,
        sound_type: sound.sound_type || 'bell',
        duration_sec: sound.duration_sec || 0,
        is_default: sound.is_default || false,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error saving sound record in Supabase:', error.message);
    throw error;
  }

  return data;
}

export async function deleteSoundApi(id: string, storagePath?: string | null): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');

  if (storagePath) {
    try {
      await sb.storage.from('bell-audio').remove([storagePath]);
    } catch (e) {
      console.warn('Storage file deletion skipped or failed:', e);
    }
  }

  const { error } = await sb.from('bell_sounds').delete().eq('id', id);
  if (error) {
    console.error('Error deleting sound from Supabase:', error.message);
    throw error;
  }
}

export async function setDefaultSoundApi(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');

  // Reset all to false first
  await sb.from('bell_sounds').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');

  // Set selected to true
  const { error } = await sb.from('bell_sounds').update({ is_default: true }).eq('id', id);
  if (error) {
    console.error('Error setting default sound:', error.message);
    throw error;
  }
}

// -------------------------------------------------------------
// Logs API
// -------------------------------------------------------------

export async function fetchLogsApi(limit = 50): Promise<BellLog[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('bell_logs')
    .select('*')
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching logs from Supabase:', error.message);
    throw error;
  }

  return data || [];
}

export async function recordBellLogApi(log: Omit<BellLog, 'id'>): Promise<BellLog | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('bell_logs')
      .insert([
        {
          schedule_id: log.schedule_id || null,
          event_name: log.event_name,
          triggered_at: log.triggered_at,
          status: log.status,
          played_by: log.played_by || 'PA System',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Failed to record bell log:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Exception recording bell log:', err);
    return null;
  }
}

// -------------------------------------------------------------
// Settings API
// -------------------------------------------------------------

export async function fetchSettingsApi(): Promise<SchoolSettings> {
  const defaultSettings: SchoolSettings = {
    school_name: 'Central High School',
    pa_zone: 'Main Campus PA System',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    master_volume: 0.9,
    auto_arm: true,
    repeat_default_count: 1,
  };

  const sb = getSupabase();
  if (!sb) return defaultSettings;

  const { data, error } = await sb.from('school_settings').select('*').limit(1).maybeSingle();

  if (error) {
    console.warn('Could not fetch school settings from Supabase, using defaults:', error.message);
    return defaultSettings;
  }

  if (data) {
    return {
      ...defaultSettings,
      ...data,
      master_volume: typeof data.master_volume === 'number' ? data.master_volume : 0.9,
    };
  }

  return defaultSettings;
}

export async function updateSettingsApi(updates: Partial<SchoolSettings>): Promise<SchoolSettings> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');

  const { data: existing } = await sb.from('school_settings').select('id').limit(1).maybeSingle();

  let response;
  if (existing?.id) {
    response = await sb
      .from('school_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    response = await sb
      .from('school_settings')
      .insert([{ ...updates }])
      .select()
      .single();
  }

  if (response.error) {
    console.error('Error saving settings to Supabase:', response.error.message);
    throw response.error;
  }

  return response.data;
}
