/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { SchedulePage } from './pages/SchedulePage';
import { SoundLibraryPage } from './pages/SoundLibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { LogsPage } from './pages/LogsPage';
import { AudioVisualizer } from './components/AudioVisualizer';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { BellSchedule, BellSound, BellLog, SchoolSettings } from './types/bell';
import { 
  fetchSchedulesApi, 
  fetchSoundsApi, 
  fetchLogsApi, 
  fetchSettingsApi, 
  isSupabaseConfigured,
  getSupabase 
} from './lib/supabaseClient';
import { schedulerEngine } from './services/schedulerEngine';
import { audioEngine } from './services/audioEngine';
import { Database, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [schedules, setSchedules] = useState<BellSchedule[]>([]);
  const [sounds, setSounds] = useState<BellSound[]>([]);
  const [logs, setLogs] = useState<BellLog[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>({
    school_name: 'Central High School',
    pa_zone: 'Main Campus PA System',
    timezone: 'Africa/Accra',
    master_volume: 0.9,
    auto_arm: true,
    repeat_default_count: 1,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAudioArmed, setIsAudioArmed] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Load all data from real Supabase
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setDbError(null);

    try {
      if (isSupabaseConfigured()) {
        const [fetchedSchedules, fetchedSounds, fetchedLogs, fetchedSettings] = await Promise.all([
          fetchSchedulesApi().catch((err) => {
            console.warn('Could not fetch schedules:', err);
            return [] as BellSchedule[];
          }),
          fetchSoundsApi().catch((err) => {
            console.warn('Could not fetch sounds:', err);
            return [] as BellSound[];
          }),
          fetchLogsApi(50).catch((err) => {
            console.warn('Could not fetch logs:', err);
            return [] as BellLog[];
          }),
          fetchSettingsApi().catch((err) => {
            console.warn('Could not fetch settings:', err);
            return settings;
          }),
        ]);

        setSchedules(fetchedSchedules);
        setSounds(fetchedSounds);
        setLogs(fetchedLogs);
        setSettings(fetchedSettings);
        schedulerEngine.setSchedules(fetchedSchedules);

        if (typeof fetchedSettings.master_volume === 'number') {
          audioEngine.setMasterVolume(fetchedSettings.master_volume);
        }
      } else {
        // Supabase not configured yet
        setSchedules([]);
        setSounds([]);
        setLogs([]);
        schedulerEngine.setSchedules([]);
      }
    } catch (err: any) {
      console.error('Data load failure:', err);
      setDbError(err.message || 'Failed to load application data from Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, [settings]);

  // Initial load & Supabase Realtime Subscription setup
  useEffect(() => {
    loadData();

    // Check if audio is already armed from user session
    setIsAudioArmed(audioEngine.isArmed());

    // Setup Supabase Realtime Channel
    const sb = getSupabase();
    if (sb) {
      const channel = sb
        .channel('school-bell-db-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bell_schedules' },
          () => {
            fetchSchedulesApi().then((fresh) => {
              setSchedules(fresh);
              schedulerEngine.setSchedules(fresh);
            });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bell_sounds' },
          () => {
            fetchSoundsApi().then((fresh) => setSounds(fresh));
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'bell_logs' },
          (payload) => {
            setLogs((prev) => [payload.new as BellLog, ...prev.slice(0, 49)]);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'school_settings' },
          () => {
            fetchSettingsApi().then((fresh) => setSettings(fresh));
          }
        )
        .subscribe();

      return () => {
        sb.removeChannel(channel);
      };
    }
  }, [loadData]);

  // Listen for audio engine status changes
  useEffect(() => {
    return audioEngine.subscribe(() => {
      setIsAudioArmed(audioEngine.isArmed());
    });
  }, []);

  const handleToggleAudioArm = async () => {
    if (!isAudioArmed) {
      const armed = await audioEngine.armAudioEngine();
      setIsAudioArmed(armed);
    } else {
      audioEngine.stopPlayback();
    }
  };

  const handleTriggerScheduleManually = async (schedule: BellSchedule) => {
    await audioEngine.armAudioEngine();
    setIsAudioArmed(true);
    await schedulerEngine.executeBell(schedule, 'manual');
    // Refresh logs
    fetchLogsApi(50).then((fresh) => setLogs(fresh));
  };

  const handleMasterVolumeChange = (vol: number) => {
    setSettings((prev) => ({ ...prev, master_volume: vol }));
    audioEngine.setMasterVolume(vol);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        isAudioArmed={isAudioArmed}
        onToggleAudioArm={handleToggleAudioArm}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        schoolName={settings.school_name}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isLoading ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span className="text-xs font-medium">Synchronizing school bell timetable...</span>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardPage
                schedules={schedules}
                logs={logs}
                settings={settings}
                isAudioArmed={isAudioArmed}
                onArmAudio={handleToggleAudioArm}
                onNavigateToSchedule={() => setActiveTab('schedule')}
                onTriggerScheduleManually={handleTriggerScheduleManually}
              />
            )}

            {activeTab === 'schedule' && (
              <SchedulePage
                schedules={schedules}
                sounds={sounds}
                onRefresh={loadData}
                onTriggerScheduleManually={handleTriggerScheduleManually}
              />
            )}

            {activeTab === 'sounds' && (
              <SoundLibraryPage
                sounds={sounds}
                onRefresh={loadData}
                onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
              />
            )}

            {activeTab === 'logs' && (
              <LogsPage
                logs={logs}
                onRefresh={loadData}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                settings={settings}
                sounds={sounds}
                onRefresh={loadData}
                onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Persistent Audio Visualizer Popup when bell is playing */}
      <AudioVisualizer />

      {/* Modals */}
      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />
    </div>
  );
}
