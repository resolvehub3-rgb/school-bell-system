export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, ..., 6=Saturday

export interface BellSchedule {
  id: string;
  name: string;
  time: string; // HH:mm format, 24-hour (e.g. "08:30")
  category: 'School Opening' | 'Assembly' | 'First Period' | 'Period' | 'Break Time' | 'End of Break' | 'Closing' | 'Custom Event';
  days_of_week: DayOfWeek[]; // e.g. [1, 2, 3, 4, 5] for Mon-Fri
  sound_id?: string | null;
  sound_name?: string | null;
  sound_url?: string | null;
  announcement_id?: string | null;
  announcement_name?: string | null;
  announcement_url?: string | null;
  announcement_delay_sec?: number; // Delay between bell chime and voice announcement, e.g. 1
  repeat_count: number; // e.g. 1, 2, 3
  repeat_interval_sec: number; // e.g. 2
  is_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BellSound {
  id: string;
  name: string;
  file_url: string;
  storage_path?: string | null;
  format: 'mp3' | 'wav' | 'ogg' | 'synthesized';
  sound_type?: 'bell' | 'announcement'; // 'bell' = bell chime, 'announcement' = voice announcement
  duration_sec?: number;
  is_default: boolean;
  created_at?: string;
}

export interface BellLog {
  id: string;
  schedule_id?: string | null;
  event_name: string;
  triggered_at: string;
  status: 'played' | 'manual' | 'stopped' | 'failed';
  played_by?: string;
}

export interface SchoolSettings {
  id?: string;
  school_name: string;
  pa_zone: string;
  timezone: string;
  default_sound_id?: string | null;
  master_volume: number; // 0.0 to 1.0
  auto_arm: boolean;
  repeat_default_count: number;
}

export interface NextBellInfo {
  schedule: BellSchedule;
  triggerDate: Date;
  secondsRemaining: number;
  formattedCountdown: string;
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  currentEventName: string | null;
  currentPhase: 'idle' | 'bell' | 'announcement';
  currentAnnouncementName?: string | null;
  currentIteration: number;
  totalIterations: number;
  sourceType: 'schedule' | 'manual';
}
