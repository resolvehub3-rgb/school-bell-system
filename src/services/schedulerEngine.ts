import { BellSchedule, NextBellInfo, DayOfWeek } from '../types/bell';
import { audioEngine } from './audioEngine';
import { recordBellLogApi } from '../lib/supabaseClient';

type NextBellListener = (nextBell: NextBellInfo | null) => void;
type TickListener = (currentTime: Date) => void;

// Helper to calculate exact time parts in Ghana Official School Time (Africa/Accra - GMT / UTC+0)
export function getGhanaTimeParts(now: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const findVal = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const year = parseInt(findVal('year'), 10);
  const month = parseInt(findVal('month'), 10);
  const day = parseInt(findVal('day'), 10);
  const hour = parseInt(findVal('hour'), 10);
  const minute = parseInt(findVal('minute'), 10);
  const second = parseInt(findVal('second'), 10);

  // UTC epoch representation of Ghana time (GMT/UTC+0)
  const ghanaUtcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const dayOfWeek = ghanaUtcDate.getUTCDay() as DayOfWeek;

  const hoursStr = String(hour).padStart(2, '0');
  const minutesStr = String(minute).padStart(2, '0');
  const timeStr = `${hoursStr}:${minutesStr}`;
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dayOfWeek,
    timeStr,
    dateKey,
    ghanaUtcDate,
    epochMs: ghanaUtcDate.getTime(),
  };
}

class SchedulerEngine {
  private timerId: any = null;
  private schedules: BellSchedule[] = [];
  private nextBellListeners: Set<NextBellListener> = new Set();
  private tickListeners: Set<TickListener> = new Set();
  private isLeaderTab: boolean = true;
  private channel: BroadcastChannel | null = null;
  private tabId: string = Math.random().toString(36).substring(2, 9);
  private lastCheckedSecond: number = -1;

  constructor() {
    this.initMultiTabCoordination();
    this.startSchedulerLoop();
  }

  // Multi-tab leader election using BroadcastChannel so only 1 tab plays audio
  private initMultiTabCoordination() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      this.isLeaderTab = true;
      return;
    }

    try {
      this.channel = new BroadcastChannel('school-bell-pa-coordinator');
      
      this.channel.onmessage = (event) => {
        const { type, senderId, payload } = event.data || {};
        if (type === 'HEARTBEAT_LEADER') {
          if (senderId !== this.tabId) {
            // Another tab is the leader
            this.isLeaderTab = false;
          }
        } else if (type === 'BELL_TRIGGERED') {
          // Another tab triggered bell, sync state or UI if needed
        }
      };

      // Claim leader if no other leader heartbeats within 1 second
      setInterval(() => {
        if (this.isLeaderTab && this.channel) {
          this.channel.postMessage({
            type: 'HEARTBEAT_LEADER',
            senderId: this.tabId,
          });
        }
      }, 2000);
    } catch (e) {
      this.isLeaderTab = true;
    }
  }

  public setSchedules(schedules: BellSchedule[]) {
    this.schedules = schedules;
    this.recalculateNextBell();
  }

  private startSchedulerLoop() {
    if (typeof window === 'undefined') return;

    if (this.timerId) {
      clearInterval(this.timerId);
    }

    // High precision tick every 500ms
    this.timerId = setInterval(() => {
      this.handleClockTick();
    }, 500);
  }

  private handleClockTick() {
    const now = new Date();
    const currentSecond = now.getSeconds();

    // Notify clock listeners every second
    if (currentSecond !== this.lastCheckedSecond) {
      this.lastCheckedSecond = currentSecond;
      this.notifyTickListeners(now);

      // Check for scheduled bell trigger at the top of the minute (00-02 seconds window)
      if (currentSecond <= 2) {
        this.evaluateBellTriggers(now);
      }

      this.recalculateNextBell();
    }
  }

  // -------------------------------------------------------------
  // Duplicate-Proof Schedule Evaluation
  // -------------------------------------------------------------

  private evaluateBellTriggers(now: Date) {
    if (!this.isLeaderTab) {
      return; // Only leader tab triggers hardware audio
    }

    const ghana = getGhanaTimeParts(now);
    const currentDay = ghana.dayOfWeek;
    const currentTimeStr = ghana.timeStr;
    const dateKey = ghana.dateKey;

    // Find enabled schedules matching today's day of week in Ghana and this exact HH:mm in Ghana
    const matchingSchedules = this.schedules.filter(sch => {
      if (!sch.is_enabled) return false;
      if (sch.time !== currentTimeStr) return false;
      const days = Array.isArray(sch.days_of_week) ? sch.days_of_week : [];
      return days.includes(currentDay);
    });

    matchingSchedules.forEach(schedule => {
      const executionKey = `BELL_EXEC_${schedule.id}_${dateKey}_${schedule.time}`;

      // Check if already executed today
      if (typeof window !== 'undefined' && localStorage.getItem(executionKey)) {
        return; // Prevent duplicate trigger!
      }

      // Mark as executed immediately in localStorage BEFORE starting sound to eliminate race conditions
      if (typeof window !== 'undefined') {
        localStorage.setItem(executionKey, new Date().toISOString());
        this.pruneOldExecutionKeys();
      }

      // Broadcast to other tabs
      if (this.channel) {
        this.channel.postMessage({
          type: 'BELL_TRIGGERED',
          senderId: this.tabId,
          payload: { scheduleId: schedule.id, name: schedule.name },
        });
      }

      // Trigger actual audio playback
      this.executeBell(schedule, 'schedule');
    });
  }

  public async executeBell(schedule: BellSchedule, sourceType: 'schedule' | 'manual' = 'schedule') {
    // Record to database logs
    recordBellLogApi({
      schedule_id: schedule.id,
      event_name: schedule.name,
      triggered_at: new Date().toISOString(),
      status: sourceType === 'schedule' ? 'played' : 'manual',
      played_by: sourceType === 'schedule' ? 'Automated Scheduler' : 'Administrator (Manual)',
    }).catch(e => console.warn('Could not record bell log to Supabase:', e));

    // Show native desktop notification if allowed
    this.sendDesktopNotification(schedule);

    // Play through audio engine (bell chime first, voice announcement follows)
    await audioEngine.playBellSequence({
      eventName: schedule.name,
      soundUrl: schedule.sound_url,
      announcementUrl: schedule.announcement_url,
      announcementName: schedule.announcement_name,
      announcementDelaySec: schedule.announcement_delay_sec ?? 1,
      repeatCount: schedule.repeat_count || 1,
      repeatIntervalSec: schedule.repeat_interval_sec || 2,
      sourceType,
    });
  }

  private sendDesktopNotification(schedule: BellSchedule) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`School Bell: ${schedule.name}`, {
          body: `Scheduled for ${schedule.time}. Playing through PA speaker system.`,
          icon: '/favicon.ico',
        });
      } catch (e) {}
    }
  }

  private pruneOldExecutionKeys() {
    try {
      const now = Date.now();
      const twoDaysMs = 48 * 60 * 60 * 1000;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('BELL_EXEC_')) {
          const val = localStorage.getItem(key);
          if (val) {
            const time = new Date(val).getTime();
            if (now - time > twoDaysMs) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // Next Bell Calculation
  // -------------------------------------------------------------

  public recalculateNextBell(): NextBellInfo | null {
    if (!this.schedules || this.schedules.length === 0) {
      this.notifyNextBellListeners(null);
      return null;
    }

    const enabledSchedules = this.schedules.filter(s => s.is_enabled);
    if (enabledSchedules.length === 0) {
      this.notifyNextBellListeners(null);
      return null;
    }

    const now = new Date();
    const ghanaNow = getGhanaTimeParts(now);

    let nearestSchedule: BellSchedule | null = null;
    let nearestDate: Date | null = null;
    let minSecondsRemaining = Infinity;

    // Scan up to 7 days ahead in Ghana time to find the earliest upcoming bell
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetUtcDate = new Date(ghanaNow.ghanaUtcDate);
      targetUtcDate.setUTCDate(ghanaNow.day + dayOffset);
      const targetDay = targetUtcDate.getUTCDay() as DayOfWeek;

      for (const schedule of enabledSchedules) {
        const days = Array.isArray(schedule.days_of_week) ? schedule.days_of_week : [];
        if (!days.includes(targetDay)) continue;

        const [hh, mm] = schedule.time.split(':').map(Number);
        const scheduleDateTime = new Date(targetUtcDate);
        scheduleDateTime.setUTCHours(hh, mm, 0, 0);

        const diffSeconds = Math.floor((scheduleDateTime.getTime() - ghanaNow.epochMs) / 1000);

        // Bell must be in the future (at least 2 seconds ahead so it doesn't immediately match current ringing)
        if (diffSeconds > 1 && diffSeconds < minSecondsRemaining) {
          minSecondsRemaining = diffSeconds;
          nearestSchedule = schedule;
          nearestDate = scheduleDateTime;
        }
      }

      // If we found a bell on this day and it's today or tomorrow, break early
      if (nearestSchedule && minSecondsRemaining < 86400) {
        break;
      }
    }

    if (!nearestSchedule || !nearestDate) {
      this.notifyNextBellListeners(null);
      return null;
    }

    const hours = Math.floor(minSecondsRemaining / 3600);
    const minutes = Math.floor((minSecondsRemaining % 3600) / 60);
    const seconds = minSecondsRemaining % 60;

    let formattedCountdown = '';
    if (hours > 0) {
      formattedCountdown = `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    } else {
      formattedCountdown = `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }

    const nextInfo: NextBellInfo = {
      schedule: nearestSchedule,
      triggerDate: nearestDate,
      secondsRemaining: minSecondsRemaining,
      formattedCountdown,
    };

    this.notifyNextBellListeners(nextInfo);
    return nextInfo;
  }

  // -------------------------------------------------------------
  // Listeners & Subscriptions
  // -------------------------------------------------------------

  public subscribeTick(listener: TickListener): () => void {
    this.tickListeners.add(listener);
    listener(new Date());
    return () => this.tickListeners.delete(listener);
  }

  public subscribeNextBell(listener: NextBellListener): () => void {
    this.nextBellListeners.add(listener);
    this.recalculateNextBell();
    return () => this.nextBellListeners.delete(listener);
  }

  private notifyTickListeners(now: Date) {
    this.tickListeners.forEach(fn => fn(now));
  }

  private notifyNextBellListeners(next: NextBellInfo | null) {
    this.nextBellListeners.forEach(fn => fn(next));
  }

  public getIsLeaderTab(): boolean {
    return this.isLeaderTab;
  }
}

export const schedulerEngine = new SchedulerEngine();
