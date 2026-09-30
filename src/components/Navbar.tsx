import React from 'react';
import { Volume2, VolumeX, ShieldCheck, ShieldAlert, Database, Bell } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export type NavTab = 'dashboard' | 'schedule' | 'sounds' | 'logs' | 'settings';

interface Props {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isAudioArmed: boolean;
  onToggleAudioArm: () => void;
  onOpenSupabaseModal: () => void;
  schoolName: string;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  onTabChange,
  isAudioArmed,
  onToggleAudioArm,
  onOpenSupabaseModal,
  schoolName,
}) => {
  const isDbConfigured = isSupabaseConfigured();

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onTabChange('dashboard')}
            className="text-left group flex items-center gap-2.5"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
              <Bell className="w-4 h-4 fill-current" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-100 group-hover:text-amber-400 transition-colors">
                {schoolName || 'School Bell System'}
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: 4-6 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`transition-colors py-1 ${
              activeTab === 'dashboard'
                ? 'text-amber-400 border-b-2 border-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => onTabChange('schedule')}
            className={`transition-colors py-1 ${
              activeTab === 'schedule'
                ? 'text-amber-400 border-b-2 border-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bell Schedule
          </button>

          <button
            onClick={() => onTabChange('sounds')}
            className={`transition-colors py-1 ${
              activeTab === 'sounds'
                ? 'text-amber-400 border-b-2 border-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sound Library
          </button>

          <button
            onClick={() => onTabChange('logs')}
            className={`transition-colors py-1 ${
              activeTab === 'logs'
                ? 'text-amber-400 border-b-2 border-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Activity Logs
          </button>

          <button
            onClick={() => onTabChange('settings')}
            className={`transition-colors py-1 ${
              activeTab === 'settings'
                ? 'text-amber-400 border-b-2 border-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2.5">
          {/* PA Audio Engine Armed Indicator & Arm Trigger */}
          <button
            onClick={onToggleAudioArm}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              isAudioArmed
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold shadow-md shadow-amber-500/20'
            }`}
            title={
              isAudioArmed
                ? 'Audio engine is armed and ready to trigger automated chimes through the connected speaker.'
                : 'Click to arm audio engine. Required by browsers to allow automated sound playback.'
            }
          >
            {isAudioArmed ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>PA Armed</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Arm PA Speaker</span>
              </>
            )}
          </button>

          {/* Database connection indicator */}
          <button
            onClick={onOpenSupabaseModal}
            className={`p-2 rounded-lg border transition-colors ${
              isDbConfigured
                ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
            }`}
            title={isDbConfigured ? 'Supabase Database Connected' : 'Supabase Database Setup Required'}
          >
            <Database className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/60 bg-slate-900/95 py-2 px-2 text-xs">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`px-2 py-1 ${activeTab === 'dashboard' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onTabChange('schedule')}
          className={`px-2 py-1 ${activeTab === 'schedule' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Schedule
        </button>
        <button
          onClick={() => onTabChange('sounds')}
          className={`px-2 py-1 ${activeTab === 'sounds' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Sounds
        </button>
        <button
          onClick={() => onTabChange('logs')}
          className={`px-2 py-1 ${activeTab === 'logs' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Logs
        </button>
        <button
          onClick={() => onTabChange('settings')}
          className={`px-2 py-1 ${activeTab === 'settings' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Settings
        </button>
      </div>
    </header>
  );
};
