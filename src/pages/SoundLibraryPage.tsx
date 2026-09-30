import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Music, 
  Play, 
  Square, 
  Trash2, 
  Check, 
  Star, 
  AlertCircle, 
  CheckCircle2, 
  FileAudio,
  Radio,
  Bell,
  Megaphone,
  Filter
} from 'lucide-react';
import { BellSound } from '../types/bell';
import { 
  uploadSoundFileApi, 
  createSoundApi, 
  deleteSoundApi, 
  setDefaultSoundApi, 
  isSupabaseConfigured 
} from '../lib/supabaseClient';
import { audioEngine } from '../services/audioEngine';

interface Props {
  sounds: BellSound[];
  onRefresh: () => Promise<void>;
  onOpenSupabaseModal: () => void;
}

export const SoundLibraryPage: React.FC<Props> = ({
  sounds,
  onRefresh,
  onOpenSupabaseModal,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'bell' | 'announcement'>('bell');
  const [filterType, setFilterType] = useState<'all' | 'bell' | 'announcement'>('all');
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------------------------------------------------
  // File Upload to Real Supabase Storage
  // -------------------------------------------------------------
  const handleFileUpload = async (file: File) => {
    if (!isSupabaseConfigured()) {
      setErrorMessage('Supabase is not configured. Please connect your database and storage bucket first.');
      onOpenSupabaseModal();
      return;
    }

    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/wave'];
    const validExts = ['.mp3', '.wav', '.ogg'];
    const hasValidExt = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExt) {
      setErrorMessage('Unsupported file format. Please upload real .mp3, .wav, or .ogg audio files.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(`Uploading ${uploadType === 'announcement' ? 'voice announcement' : 'bell chime'} "${file.name}" to Supabase Storage...`);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Measure real audio duration
      const audioUrl = URL.createObjectURL(file);
      const audioObj = new Audio(audioUrl);
      let durationSec = 0;

      await new Promise<void>((resolve) => {
        audioObj.onloadedmetadata = () => {
          durationSec = Math.round(audioObj.duration * 10) / 10;
          resolve();
        };
        audioObj.onerror = () => resolve();
        setTimeout(resolve, 2000); // safety fallback
      });

      // Upload to Supabase Storage
      const { fileUrl, storagePath } = await uploadSoundFileApi(file);

      // Determine format
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      const cleanFormat = ext === 'wav' ? 'wav' : ext === 'ogg' ? 'ogg' : 'mp3';

      // Insert record into Supabase bell_sounds table
      await createSoundApi({
        name: file.name.replace(/\.[^/.]+$/, ''),
        file_url: fileUrl,
        storage_path: storagePath,
        format: cleanFormat,
        sound_type: uploadType,
        duration_sec: durationSec,
        is_default: uploadType === 'bell' && sounds.filter(s => s.sound_type === 'bell').length === 0,
      });

      setSuccessMessage(`Successfully uploaded ${uploadType === 'announcement' ? 'announcement voice track' : 'bell sound'} "${file.name}".`);
      await onRefresh();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMessage(err.message || 'Failed to upload sound to Supabase Storage.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // -------------------------------------------------------------
  // Audio Preview & Actions
  // -------------------------------------------------------------
  const handlePlaySound = async (sound: BellSound) => {
    if (playingSoundId === sound.id) {
      audioEngine.stopPlayback();
      setPlayingSoundId(null);
      return;
    }

    setPlayingSoundId(sound.id);
    await audioEngine.armAudioEngine();

    try {
      if (sound.file_url) {
        await audioEngine.playAudioUrl(sound.file_url, 1.0);
      }
    } finally {
      setPlayingSoundId(null);
    }
  };

  const handleSetDefault = async (soundId: string) => {
    try {
      await setDefaultSoundApi(soundId);
      await onRefresh();
    } catch (err: any) {
      alert(`Could not set default sound: ${err.message}`);
    }
  };

  const handleDeleteSound = async (sound: BellSound) => {
    if (!confirm(`Are you sure you want to delete the sound "${sound.name}"?`)) {
      return;
    }
    try {
      await deleteSoundApi(sound.id, sound.storage_path);
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to delete sound: ${err.message}`);
    }
  };

  const filteredSounds = sounds.filter((snd) => {
    if (filterType === 'all') return true;
    const type = snd.sound_type || 'bell';
    return type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Music className="w-5 h-5 text-amber-400" />
            <span>Sound & Announcement Library</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Upload genuine bell chimes and voice announcements (.mp3, .wav, .ogg) to play across your school PA system
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".mp3,.wav,.ogg,audio/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>Upload {uploadType === 'bell' ? 'Bell Sound' : 'Announcement'}</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Upload Type Selector & Drag-and-Drop Area */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <label className="text-xs font-semibold text-slate-200">
              Select Audio Category to Upload:
            </label>
            <p className="text-[11px] text-slate-400">
              Choose whether you are uploading a bell chime (rings first) or a voice announcement (follows the chime).
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setUploadType('bell')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                uploadType === 'bell'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Bell / Chime (1st)</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadType('announcement')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                uploadType === 'announcement'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Voice Announcement (2nd)</span>
            </button>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isUploading
              ? 'border-amber-500 bg-amber-500/5'
              : uploadType === 'announcement'
              ? 'border-blue-500/40 hover:border-blue-500 bg-blue-950/10 hover:bg-blue-950/20'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 border ${
              uploadType === 'announcement'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {uploadType === 'announcement' ? (
              <Megaphone className="w-6 h-6" />
            ) : (
              <FileAudio className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-200">
            {isUploading
              ? uploadProgress
              : `Click or drag & drop ${
                  uploadType === 'announcement' ? 'voice announcement' : 'bell chime'
                } audio file here`}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Supports real school audio in <strong>.wav</strong>, <strong>.mp3</strong>, or <strong>.ogg</strong>. Files are stored directly in Supabase Storage.
          </p>
        </div>
      </div>

      {/* Uploaded Real Sounds Table with Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">Registered Audio Files</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Bell chimes and voice announcements stored in Supabase and ready for scheduling
            </p>
          </div>

          {/* Segmented Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({sounds.length})
            </button>
            <button
              onClick={() => setFilterType('bell')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${
                filterType === 'bell'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="w-3 h-3" />
              <span>Chimes ({sounds.filter((s) => (s.sound_type || 'bell') === 'bell').length})</span>
            </button>
            <button
              onClick={() => setFilterType('announcement')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${
                filterType === 'announcement'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Megaphone className="w-3 h-3" />
              <span>Voice Announcements ({sounds.filter((s) => s.sound_type === 'announcement').length})</span>
            </button>
          </div>
        </div>

        {filteredSounds.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Music className="w-6 h-6 opacity-40" />
            </div>
            <h4 className="text-base font-semibold text-slate-200">
              {filterType === 'announcement'
                ? 'No voice announcements uploaded yet'
                : filterType === 'bell'
                ? 'No bell sounds uploaded yet'
                : 'No audio files uploaded yet'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Upload your school's bell audio or voice announcement tracks (.mp3, .wav, .ogg) using the upload box above.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Audio File</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredSounds.map((sound) => {
              const isPlayingThis = playingSoundId === sound.id;
              const isVoice = sound.sound_type === 'announcement';

              return (
                <div
                  key={sound.id}
                  className={`p-4 sm:px-6 flex items-center justify-between gap-4 transition-colors ${
                    isPlayingThis ? 'bg-amber-500/10' : 'hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <button
                      onClick={() => handlePlaySound(sound)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                        isPlayingThis
                          ? isVoice
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-amber-500 text-slate-950 font-bold'
                          : isVoice
                          ? 'bg-slate-800 hover:bg-slate-700 text-blue-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-400'
                      }`}
                      title={isPlayingThis ? 'Stop Playback' : 'Preview Audio Track'}
                    >
                      {isPlayingThis ? (
                        <Square className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-100 truncate">
                          {sound.name}
                        </h4>
                        {/* Audio Type Tag */}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border flex items-center gap-1 ${
                            isVoice
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {isVoice ? <Megaphone className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                          <span>{isVoice ? 'Voice Announcement' : 'Bell Chime'}</span>
                        </span>

                        {sound.is_default && !isVoice && (
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            Default Chime
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="uppercase font-mono">{sound.format}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{sound.duration_sec || 0}s duration</span>
                        {sound.storage_path && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-500 truncate max-w-[200px]">Supabase Storage</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!sound.is_default && !isVoice && (
                      <button
                        onClick={() => handleSetDefault(sound.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                        title="Set as School Default Bell Sound"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Set Default</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteSound(sound)}
                      className="p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                      title="Delete Sound"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
