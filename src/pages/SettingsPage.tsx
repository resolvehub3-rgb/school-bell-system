import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Volume2, 
  Clock, 
  School, 
  Database, 
  Radio, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  HelpCircle 
} from 'lucide-react';
import { SchoolSettings, BellSound } from '../types/bell';
import { updateSettingsApi, isSupabaseConfigured } from '../lib/supabaseClient';
import { audioEngine } from '../services/audioEngine';

interface Props {
  settings: SchoolSettings;
  sounds: BellSound[];
  onRefresh: () => Promise<void>;
  onOpenSupabaseModal: () => void;
}

const COMMON_TIMEZONES = [
  'Africa/Accra',
];

export const SettingsPage: React.FC<Props> = ({
  settings,
  sounds,
  onRefresh,
  onOpenSupabaseModal,
}) => {
  const [formData, setFormData] = useState<SchoolSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedSchema, setCopiedSchema] = useState(false);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handleVolumeChange = (vol: number) => {
    setFormData((prev) => ({ ...prev, master_volume: vol }));
    audioEngine.setMasterVolume(vol);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');

    try {
      if (isSupabaseConfigured()) {
        await updateSettingsApi(formData);
      }
      audioEngine.setMasterVolume(formData.master_volume);
      setSaveSuccess(true);
      await onRefresh();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setErrorMessage(err.message || 'Failed to save settings to database.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-amber-400" />
          <span>System Settings & PA Configuration</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure school identity, campus audio volume, timezone, and system preferences
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Settings successfully saved.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* School Identity */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <School className="w-4 h-4 text-amber-400" />
            <span>School Identification</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                School / Institution Name
              </label>
              <input
                type="text"
                required
                value={formData.school_name}
                onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                PA Zone / Target Output Area
              </label>
              <input
                type="text"
                value={formData.pa_zone}
                onChange={(e) => setFormData({ ...formData, pa_zone: e.target.value })}
                placeholder="e.g. Main Campus PA System"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Timezone & Clock Accuracy */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Time Zone & Scheduling Synchronization</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Official School Time Zone
              </label>
              <select
                value="Africa/Accra"
                onChange={(e) => setFormData({ ...formData, timezone: 'Africa/Accra' })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="Africa/Accra">
                  🇬🇭 Ghana (Africa/Accra — Greenwich Mean Time / GMT)
                </option>
              </select>
              <p className="text-[11px] text-amber-400/90 mt-1.5 flex items-center gap-1">
                <span>✓ Synchronized exclusively with Ghana Standard Time (GMT / UTC+0).</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Bell Sound
              </label>
              <select
                value={formData.default_sound_id || ''}
                onChange={(e) => setFormData({ ...formData, default_sound_id: e.target.value || null })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="">{sounds.length === 0 ? 'No uploaded sound files available' : 'None selected'}</option>
                {sounds.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.format.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Audio & Master PA Volume */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-400" />
              <span>PA Audio Output & Master Volume</span>
            </h3>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Master PA Gain Level</span>
              <span className="font-mono text-xs font-bold text-amber-400">
                {Math.round(formData.master_volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={formData.master_volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">
              Controls the output signal gain sent to the computer speaker or amplifier line-in port.
            </p>
          </div>
        </div>

        {/* Operating Instructions & Reliability Guidelines */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>Reliable Continuous Operation Tips for School PA Computers</span>
          </div>
          <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
            <li>
              <strong>Arm PA Audio Engine:</strong> Modern browsers require a user click on the page before playing audio. Click "Arm PA Speaker" whenever launching the application.
            </li>
            <li>
              <strong>Computer Sleep Settings:</strong> Ensure the PA host computer is set to <em>"Never Sleep"</em> during school hours (07:00 – 17:00) in operating system power options.
            </li>
            <li>
              <strong>Duplicate Prevention:</strong> The scheduler automatically tracks executed events by date and time key. Even if the page is refreshed or multiple tabs are open, duplicate chimes are strictly prevented.
            </li>
            <li>
              <strong>Physical Connection:</strong> Connect the computer 3.5mm audio jack or USB DAC to the school PA amplifier's <em>AUX / LINE-IN</em> input.
            </li>
          </ul>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
