import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Play, 
  Bell, 
  Calendar, 
  Clock, 
  Volume2, 
  Check, 
  X, 
  Filter, 
  AlertCircle 
} from 'lucide-react';
import { BellSchedule, BellSound, DayOfWeek } from '../types/bell';
import { createScheduleApi, updateScheduleApi, deleteScheduleApi } from '../lib/supabaseClient';
import { audioEngine } from '../services/audioEngine';

interface Props {
  schedules: BellSchedule[];
  sounds: BellSound[];
  onRefresh: () => Promise<void>;
  onTriggerScheduleManually: (schedule: BellSchedule) => void;
}

const DAYS_META: { value: DayOfWeek; label: string; short: string }[] = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

const PRESET_EVENT_NAMES = [
  'School Opening',
  'Morning Assembly',
  'Period 1 (Start)',
  'Period 2 (Start)',
  'Morning Break',
  'End of Break',
  'Period 3 (Start)',
  'Period 4 (Start)',
  'Lunch Time',
  'End of Lunch',
  'Afternoon Assembly',
  'Final Period',
  'School Dismissal / Closing',
  'Custom Event',
];

export const SchedulePage: React.FC<Props> = ({
  schedules,
  sounds,
  onRefresh,
  onTriggerScheduleManually,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BellSchedule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Filter state
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Form State
  const [formData, setFormData] = useState({
    name: 'Period 1 (Start)',
    time: '08:00',
    category: 'Period' as BellSchedule['category'],
    days_of_week: [1, 2, 3, 4, 5] as DayOfWeek[],
    sound_id: '' as string,
    announcement_id: '' as string,
    announcement_delay_sec: 1,
    repeat_count: 1,
    repeat_interval_sec: 2,
    is_enabled: true,
  });

  const openCreateModal = () => {
    setEditingSchedule(null);
    const defaultBell = sounds.find((s) => s.is_default && (s.sound_type || 'bell') === 'bell') || sounds.find((s) => (s.sound_type || 'bell') === 'bell') || sounds[0];
    setFormData({
      name: 'Morning Assembly',
      time: '08:00',
      category: 'Assembly',
      days_of_week: [1, 2, 3, 4, 5],
      sound_id: defaultBell?.id || '',
      announcement_id: '',
      announcement_delay_sec: 1,
      repeat_count: 1,
      repeat_interval_sec: 2,
      is_enabled: true,
    });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (schedule: BellSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      time: schedule.time,
      category: schedule.category,
      days_of_week: Array.isArray(schedule.days_of_week) ? [...schedule.days_of_week] : [1, 2, 3, 4, 5],
      sound_id: schedule.sound_id || '',
      announcement_id: schedule.announcement_id || '',
      announcement_delay_sec: schedule.announcement_delay_sec ?? 1,
      repeat_count: schedule.repeat_count || 1,
      repeat_interval_sec: schedule.repeat_interval_sec || 2,
      is_enabled: schedule.is_enabled,
    });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleToggleDay = (day: DayOfWeek) => {
    const exists = formData.days_of_week.includes(day);
    if (exists) {
      if (formData.days_of_week.length > 1) {
        setFormData({
          ...formData,
          days_of_week: formData.days_of_week.filter((d) => d !== day),
        });
      }
    } else {
      setFormData({
        ...formData,
        days_of_week: [...formData.days_of_week, day].sort(),
      });
    }
  };

  const handleSetWeekdays = () => {
    setFormData({
      ...formData,
      days_of_week: [1, 2, 3, 4, 5],
    });
  };

  const handleSetAllDays = () => {
    setFormData({
      ...formData,
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.time.trim()) {
      setErrorMessage('Please provide an event name and time.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const selectedSound = sounds.find((s) => s.id === formData.sound_id);
      const selectedAnnouncement = sounds.find((s) => s.id === formData.announcement_id);

      const payload = {
        name: formData.name.trim(),
        time: formData.time.trim(),
        category: formData.category,
        days_of_week: formData.days_of_week,
        sound_id: formData.sound_id || null,
        sound_name: selectedSound?.name || (sounds.find((s) => (s.sound_type || 'bell') === 'bell')?.name ?? 'School Chime Audio'),
        sound_url: selectedSound?.file_url || (sounds.find((s) => (s.sound_type || 'bell') === 'bell')?.file_url ?? null),
        announcement_id: formData.announcement_id || null,
        announcement_name: selectedAnnouncement?.name || null,
        announcement_url: selectedAnnouncement?.file_url || null,
        announcement_delay_sec: Number(formData.announcement_delay_sec) || 1,
        repeat_count: Number(formData.repeat_count) || 1,
        repeat_interval_sec: Number(formData.repeat_interval_sec) || 2,
        is_enabled: formData.is_enabled,
      };

      if (editingSchedule) {
        await updateScheduleApi(editingSchedule.id, payload);
      } else {
        await createScheduleApi(payload);
      }

      await onRefresh();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving schedule:', err);
      setErrorMessage(err.message || 'Failed to save schedule to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleEnabled = async (schedule: BellSchedule) => {
    try {
      await updateScheduleApi(schedule.id, { is_enabled: !schedule.is_enabled });
      await onRefresh();
    } catch (err: any) {
      alert(`Could not toggle schedule: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the bell schedule "${name}"?`)) {
      return;
    }
    try {
      await deleteScheduleApi(id);
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to delete schedule: ${err.message}`);
    }
  };

  // Filter schedules
  const filteredSchedules = schedules.filter((s) => {
    if (selectedDayFilter !== 'all') {
      const days = Array.isArray(s.days_of_week) ? s.days_of_week : [];
      if (!days.includes(selectedDayFilter as DayOfWeek)) return false;
    }
    if (selectedCategoryFilter !== 'all') {
      if (s.category !== selectedCategoryFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <span>Bell Schedules & Timetable</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure exact school chime times, repeat intervals, active weekdays, and sound selections
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Bell Schedule</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-300">Filter by Day:</span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setSelectedDayFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                selectedDayFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Days
            </button>
            {DAYS_META.map((d) => (
              <button
                key={d.value}
                onClick={() => setSelectedDayFilter(d.value)}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  selectedDayFilter === d.value
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {d.short}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300">Category:</span>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Categories</option>
            <option value="School Opening">School Opening</option>
            <option value="Assembly">Assembly</option>
            <option value="Period">Period</option>
            <option value="Break Time">Break Time</option>
            <option value="End of Break">End of Break</option>
            <option value="Closing">Closing</option>
            <option value="Custom Event">Custom Event</option>
          </select>
        </div>
      </div>

      {/* Schedule Table / List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {filteredSchedules.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Calendar className="w-6 h-6 opacity-40" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">No bell schedules found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {schedules.length === 0
                ? 'Your school timetable is completely empty. Create your first scheduled bell to get started.'
                : 'No schedules match the selected day or category filter.'}
            </p>
            {schedules.length === 0 && (
              <button
                onClick={openCreateModal}
                className="mt-5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Bell Schedule</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Time</th>
                  <th className="py-3 px-4">Event Name</th>
                  <th className="py-3 px-4">Active Days</th>
                  <th className="py-3 px-4">Sound & Repeat</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSchedules.map((schedule) => {
                  const days = Array.isArray(schedule.days_of_week) ? schedule.days_of_week : [];

                  return (
                    <tr
                      key={schedule.id}
                      className={`hover:bg-slate-850 transition-colors ${
                        !schedule.is_enabled ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Time */}
                      <td className="py-4 px-4 sm:px-6 font-mono text-base font-bold text-slate-100 tabular-nums whitespace-nowrap">
                        {schedule.time}
                      </td>

                      {/* Event Name & Category */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-100">{schedule.name}</div>
                        <div className="text-[11px] text-slate-400">{schedule.category}</div>
                      </td>

                      {/* Active Days */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          {DAYS_META.map((d) => {
                            const isActive = days.includes(d.value);
                            return (
                              <span
                                key={d.value}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  isActive
                                    ? 'bg-amber-500/20 text-amber-300 font-bold'
                                    : 'text-slate-600'
                                }`}
                              >
                                {d.short[0]}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Sound & Voice Announcement */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <span className="font-semibold truncate max-w-[150px]">
                            {schedule.sound_name || 'Bell Chime'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({schedule.repeat_count || 1}x)
                          </span>
                        </div>
                        {schedule.announcement_name ? (
                          <div className="text-[11px] text-blue-400 flex items-center gap-1 mt-0.5 truncate max-w-[200px]">
                            <span>↳ Voice:</span>
                            <span className="font-medium truncate">{schedule.announcement_name}</span>
                            <span className="text-slate-500">({schedule.announcement_delay_sec ?? 1}s delay)</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Chime only (No voice announcement)
                          </div>
                        )}
                      </td>

                      {/* Enabled Toggle Switch */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleEnabled(schedule)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            schedule.is_enabled ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                          title={schedule.is_enabled ? 'Schedule is Active' : 'Schedule is Disabled'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              schedule.is_enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onTriggerScheduleManually(schedule)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-lg transition-colors"
                            title="Ring Bell Manually Now"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>

                          <button
                            onClick={() => openEditModal(schedule)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded-lg transition-colors"
                            title="Edit Schedule"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(schedule.id, schedule.name)}
                            className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-lg transition-colors"
                            title="Delete Schedule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>{editingSchedule ? 'Edit Bell Schedule' : 'Add New Bell Schedule'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="my-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 my-4">
              {/* Event Name with Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Bell Event Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. First Period, Lunch Break, Dismissal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
                {/* Presets quick tags */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_EVENT_NAMES.slice(0, 6).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormData({ ...formData, name: preset })}
                      className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exact Time & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Exact Time (24-Hour)
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Event Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="School Opening">School Opening</option>
                    <option value="Assembly">Assembly</option>
                    <option value="First Period">First Period</option>
                    <option value="Period">Period</option>
                    <option value="Break Time">Break Time</option>
                    <option value="End of Break">End of Break</option>
                    <option value="Closing">Closing</option>
                    <option value="Custom Event">Custom Event</option>
                  </select>
                </div>
              </div>

              {/* Days of Week Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Active Days of the Week
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSetWeekdays}
                      className="text-amber-400 hover:underline"
                    >
                      Mon–Fri
                    </button>
                    <span className="text-slate-600">·</span>
                    <button
                      type="button"
                      onClick={handleSetAllDays}
                      className="text-amber-400 hover:underline"
                    >
                      All 7 Days
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {DAYS_META.map((d) => {
                    const isSelected = formData.days_of_week.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => handleToggleDay(d.value)}
                        className={`py-2 text-center text-xs font-bold rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stage 1: Bell Chime Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  1. Bell / Chime Sound (Rings First)
                </label>
                <select
                  value={formData.sound_id}
                  onChange={(e) => setFormData({ ...formData, sound_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {sounds.length === 0 ? (
                    <option value="">No sound files uploaded yet (Upload in Sound Library)</option>
                  ) : (
                    <>
                      <option value="">Select bell / chime sound...</option>
                      {sounds.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.sound_type === 'announcement' ? '📢 [Voice] ' : '🔔 [Chime] '}
                          {s.name} ({s.format.toUpperCase()})
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Stage 2: Voice Announcement Selection */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                      <span>2. Voice Announcement (Follows the Bell)</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Plays after bell finishes</span>
                  </div>
                  <select
                    value={formData.announcement_id}
                    onChange={(e) => setFormData({ ...formData, announcement_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">No Voice Announcement — Chime Only</option>
                    {sounds.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sound_type === 'announcement' ? '📢 ' : '🔔 '}
                        {s.name} ({s.format.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {formData.announcement_id && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Pause between Bell Ringing and Voice Announcement
                    </label>
                    <select
                      value={formData.announcement_delay_sec}
                      onChange={(e) => setFormData({ ...formData, announcement_delay_sec: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value={0}>Immediate (0s pause)</option>
                      <option value={1}>1 Second Pause (Recommended)</option>
                      <option value={2}>2 Seconds Pause</option>
                      <option value={3}>3 Seconds Pause</option>
                      <option value={4}>4 Seconds Pause</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Repeat Count & Repeat Delay */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Play Repeat Count
                  </label>
                  <select
                    value={formData.repeat_count}
                    onChange={(e) => setFormData({ ...formData, repeat_count: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value={1}>1 Time (Single Chime)</option>
                    <option value={2}>2 Times</option>
                    <option value={3}>3 Times (Triple Strike)</option>
                    <option value={4}>4 Times</option>
                    <option value={5}>5 Times</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Delay Between Repeats
                  </label>
                  <select
                    value={formData.repeat_interval_sec}
                    onChange={(e) => setFormData({ ...formData, repeat_interval_sec: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value={1}>1 Second</option>
                    <option value={2}>2 Seconds</option>
                    <option value={3}>3 Seconds</option>
                    <option value={4}>4 Seconds</option>
                    <option value={5}>5 Seconds</option>
                  </select>
                </div>
              </div>

              {/* Enable Schedule Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Enable Schedule</div>
                  <div className="text-[11px] text-slate-400">Automated bell will ring when time arrives</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_enabled}
                  onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving to Database...' : editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
