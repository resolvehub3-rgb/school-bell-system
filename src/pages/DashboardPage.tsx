import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Bell, 
  Play, 
  Calendar, 
  Radio, 
  Volume2, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Plus, 
  VolumeX, 
  ShieldCheck, 
  History, 
  Square 
} from 'lucide-react';
import { BellSchedule, NextBellInfo, DayOfWeek, BellLog, SchoolSettings } from '../types/bell';
import { schedulerEngine } from '../services/schedulerEngine';
import { audioEngine } from '../services/audioEngine';
import { AudioPlaybackState } from '../types/bell';

interface Props {
  schedules: BellSchedule[];
  logs: BellLog[];
  settings: SchoolSettings;
  isAudioArmed: boolean;
  onArmAudio: () => void;
  onNavigateToSchedule: () => void;
  onTriggerScheduleManually: (schedule: BellSchedule) => void;
}

export const DashboardPage: React.FC<Props> = ({
  schedules,
  logs,
  settings,
  isAudioArmed,
  onArmAudio,
  onNavigateToSchedule,
  onTriggerScheduleManually,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [nextBell, setNextBell] = useState<NextBellInfo | null>(null);
  const [playback, setPlayback] = useState<AudioPlaybackState>(audioEngine.getPlaybackState());

  useEffect(() => {
    const unsubTick = schedulerEngine.subscribeTick((now) => {
      setCurrentTime(now);
    });

    const unsubNext = schedulerEngine.subscribeNextBell((info) => {
      setNextBell(info);
    });

    const unsubAudio = audioEngine.subscribe((state) => {
      setPlayback(state);
    });

    return () => {
      unsubTick();
      unsubNext();
      unsubAudio();
    };
  }, []);

  // Today's day of week
  const todayDay = currentTime.getDay() as DayOfWeek;

  // Filter schedules that apply to today
  const todaysSchedules = schedules
    .filter((s) => {
      const days = Array.isArray(s.days_of_week) ? s.days_of_week : [];
      return days.includes(todayDay);
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  // Determine status of each bell today
  const currentHours = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentTimeMinutes = currentHours * 60 + currentMinutes;

  const getBellStatus = (schedule: BellSchedule) => {
    if (!schedule.is_enabled) return 'disabled';
    
    // Check if this bell is currently playing
    if (playback.isPlaying && playback.currentEventName === schedule.name) {
      return 'playing';
    }

    const [hh, mm] = schedule.time.split(':').map(Number);
    const scheduleMinutes = hh * 60 + mm;

    if (nextBell && nextBell.schedule.id === schedule.id) {
      return 'next';
    }

    if (scheduleMinutes < currentTimeMinutes) {
      return 'passed';
    }

    return 'upcoming';
  };

  // Real calculated metrics for today
  const totalBellsToday = todaysSchedules.length;
  const completedBellsToday = todaysSchedules.filter((s) => {
    if (!s.is_enabled) return false;
    const [hh, mm] = s.time.split(':').map(Number);
    return hh * 60 + mm < currentTimeMinutes;
  }).length;
  const remainingBellsToday = todaysSchedules.filter((s) => {
    if (!s.is_enabled) return false;
    const [hh, mm] = s.time.split(':').map(Number);
    return hh * 60 + mm >= currentTimeMinutes;
  }).length;

  // Format digital clock in Ghana Official School Time (Africa/Accra - GMT / UTC+0)
  const timeFormatted = currentTime.toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Accra',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dateFormatted = currentTime.toLocaleDateString('en-GB', {
    timeZone: 'Africa/Accra',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Autoplay / Audio Permission Warning Banner if not armed */}
      {!isAudioArmed && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <VolumeX className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-200">Browser Audio Autoplay Restriction</h4>
              <p className="text-xs text-amber-300/80">
                Browsers require a user interaction before automated bell chimes can play through the connected PA speakers. Click below to arm the sound engine.
              </p>
            </div>
          </div>
          <button
            onClick={onArmAudio}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Arm PA Speaker System</span>
          </button>
        </div>
      )}

      {/* Hero Section: Master Clock & Next Bell Countdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main School Clock Card */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Official School Time</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-amber-400 font-medium">🇬🇭 Ghana Time (GMT)</span>
              <span className="text-slate-600">·</span>
              <span className={`inline-flex items-center gap-1 font-semibold ${isAudioArmed ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-2 h-2 rounded-full ${isAudioArmed ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {isAudioArmed ? 'PA System Armed' : 'Audio Disarmed'}
              </span>
            </div>
          </div>

          {/* Large Digital Clock */}
          <div className="my-6">
            <div className="font-mono font-extrabold text-5xl sm:text-7xl text-slate-50 tracking-tight tabular-nums select-none">
              {timeFormatted}
            </div>
            <div className="text-sm sm:text-base text-slate-400 mt-2 font-medium">
              {dateFormatted}
            </div>
          </div>

          {/* Quick Control Ribbon */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="font-mono tabular-nums text-slate-300">
                Today: <strong className="text-slate-100">{totalBellsToday}</strong> scheduled
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono tabular-nums text-slate-300">
                Completed: <strong className="text-emerald-400">{completedBellsToday}</strong>
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono tabular-nums text-slate-300">
                Remaining: <strong className="text-amber-400">{remainingBellsToday}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Next Scheduled Bell Card */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
              <span className="flex items-center gap-1.5 font-medium text-amber-400">
                <Bell className="w-4 h-4" />
                <span>Next Scheduled Event</span>
              </span>
              {nextBell && (
                <span className="font-mono text-slate-400">
                  {nextBell.schedule.time} ({nextBell.schedule.category})
                </span>
              )}
            </div>

            {nextBell ? (
              <div>
                <h3 className="text-2xl font-bold text-slate-100 truncate">
                  {nextBell.schedule.name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="text-amber-300 font-medium">🔔 Chime: {nextBell.schedule.sound_name || 'Bell Chime'} ({nextBell.schedule.repeat_count || 1}x)</span>
                  {nextBell.schedule.announcement_name && (
                    <>
                      <span className="text-slate-600">→</span>
                      <span className="text-blue-400 font-medium">📢 Voice: {nextBell.schedule.announcement_name}</span>
                    </>
                  )}
                </div>

                {/* Countdown Display */}
                <div className="mt-6 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Countdown to Chime
                  </div>
                  <div className="font-mono text-4xl sm:text-5xl font-black text-amber-400 tabular-nums">
                    {nextBell.formattedCountdown}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Scheduled at {nextBell.schedule.time} · Automatically triggers PA speaker
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-auto py-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <Bell className="w-6 h-6 opacity-40" />
                </div>
                <h4 className="text-sm font-semibold text-slate-300">No More Bells Scheduled Today</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  All bells for today have concluded or no active schedule is configured for this day.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
            {nextBell ? (
              <button
                onClick={() => onTriggerScheduleManually(nextBell.schedule)}
                disabled={playback.isPlaying}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-amber-400 fill-current" />
                <span>Ring Now (Manual Override)</span>
              </button>
            ) : (
              <button
                onClick={onNavigateToSchedule}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Bell Schedule</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Today's Timetable Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Today's Bell Timetable</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live schedule of all audio alerts configured for {dateFormatted}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToSchedule}
              className="px-3 py-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
            >
              <span>Manage Full Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {todaysSchedules.length === 0 ? (
          /* Empty State as required */
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Calendar className="w-6 h-6 opacity-40" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">No bells scheduled for today</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              There are no active bell events configured for today. Add a schedule or enable existing events to automate your school PA.
            </p>
            <button
              onClick={onNavigateToSchedule}
              className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Bell Schedule</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {todaysSchedules.map((schedule) => {
              const status = getBellStatus(schedule);
              const isPlayingThis = playback.isPlaying && playback.currentEventName === schedule.name;

              return (
                <div
                  key={schedule.id}
                  className={`p-4 sm:px-6 flex items-center justify-between gap-4 transition-colors ${
                    status === 'next'
                      ? 'bg-amber-500/5'
                      : isPlayingThis
                      ? 'bg-amber-500/10'
                      : 'hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Time display */}
                    <div className="font-mono text-lg font-bold text-slate-100 tabular-nums w-16 shrink-0">
                      {schedule.time}
                    </div>

                    {/* Status indicator */}
                    <div className="w-2.5 h-2.5 rounded-full shrink-0">
                      {status === 'playing' ? (
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                        </span>
                      ) : status === 'next' ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                      ) : status === 'passed' ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                      ) : status === 'disabled' ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500/40" />
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                      )}
                    </div>

                    {/* Event Name & Metadata (Clean zero-pill design) */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-100 truncate">
                          {schedule.name}
                        </h4>
                        {status === 'next' && (
                          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                            Next Up
                          </span>
                        )}
                        {status === 'playing' && (
                          <span className="text-[11px] font-bold text-amber-400 animate-pulse uppercase tracking-wide">
                            Broadcasting Now
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                        <span>{schedule.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>🔔 {schedule.sound_name || 'Bell Chime'} ({schedule.repeat_count || 1}x)</span>
                        {schedule.announcement_name && (
                          <>
                            <span className="text-slate-600">→</span>
                            <span className="text-blue-400">📢 {schedule.announcement_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                      {status === 'passed' ? (
                        <span className="text-slate-500">Concluded</span>
                      ) : status === 'next' ? (
                        <span className="text-amber-400 font-medium">Coming Soon</span>
                      ) : status === 'disabled' ? (
                        <span className="text-slate-500">Disabled</span>
                      ) : (
                        <span className="text-slate-400">Scheduled</span>
                      )}
                    </span>

                    <button
                      onClick={() => onTriggerScheduleManually(schedule)}
                      disabled={playback.isPlaying}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-lg transition-colors disabled:opacity-40"
                      title="Trigger Bell Sound Manually Through PA"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">Today's Audio Broadcast Log</h3>
          </div>
          <span className="text-xs text-slate-500">Real-time PA event history</span>
        </div>

        {logs.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No audio broadcast events recorded yet. Logs appear automatically whenever a bell chimes.
          </div>
        ) : (
          <div className="space-y-2.5">
            {logs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div>
                    <span className="font-medium text-slate-200">{log.event_name}</span>
                    <span className="text-slate-500 ml-2">via {log.played_by || 'PA System'}</span>
                  </div>
                </div>
                <div className="font-mono text-slate-400 tabular-nums">
                  {new Date(log.triggered_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
