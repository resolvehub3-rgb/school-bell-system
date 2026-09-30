import React, { useEffect, useState } from 'react';
import { Volume2, Square, Bell, Radio, Megaphone } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';
import { AudioPlaybackState } from '../types/bell';

export const AudioVisualizer: React.FC = () => {
  const [playback, setPlayback] = useState<AudioPlaybackState>(audioEngine.getPlaybackState());

  useEffect(() => {
    return audioEngine.subscribe((state) => {
      setPlayback(state);
    });
  }, []);

  if (!playback.isPlaying) {
    return null;
  }

  const isAnnouncement = playback.currentPhase === 'announcement';

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl p-4 text-white animate-bounce-subtle backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`relative flex items-center justify-center w-12 h-12 rounded-xl border transition-colors ${
              isAnnouncement
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            }`}
          >
            {isAnnouncement ? (
              <Megaphone className="w-6 h-6 animate-pulse" />
            ) : (
              <Bell className="w-6 h-6 animate-pulse" />
            )}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isAnnouncement ? 'bg-blue-400' : 'bg-amber-400'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  isAnnouncement ? 'bg-blue-500' : 'bg-amber-500'
                }`}
              ></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${
                  isAnnouncement ? 'text-blue-400' : 'text-amber-400'
                }`}
              >
                <Radio className="w-3 h-3 animate-spin" />
                {isAnnouncement ? 'Stage 2: Voice Announcement' : 'Stage 1: Bell Chime'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {!isAnnouncement && playback.totalIterations > 1
                  ? `Chime ${playback.currentIteration} of ${playback.totalIterations}`
                  : isAnnouncement
                  ? 'Speaking'
                  : 'Ringing'}
              </span>
            </div>
            <h4 className="text-base font-bold text-slate-100 truncate max-w-[210px]">
              {isAnnouncement
                ? playback.currentAnnouncementName || 'Voice Announcement'
                : playback.currentEventName || 'School Bell Alert'}
            </h4>
          </div>
        </div>

        {/* Live animated frequency bars */}
        <div className="flex items-end gap-1 h-8 px-2 py-1 bg-slate-950/60 rounded-lg border border-slate-800">
          <div className={`w-1.5 rounded-full animate-wave-1 ${isAnnouncement ? 'bg-blue-400' : 'bg-amber-400'}`}></div>
          <div className={`w-1.5 rounded-full animate-wave-2 ${isAnnouncement ? 'bg-blue-400' : 'bg-amber-400'}`}></div>
          <div className={`w-1.5 rounded-full animate-wave-3 ${isAnnouncement ? 'bg-blue-400' : 'bg-amber-400'}`}></div>
          <div className={`w-1.5 rounded-full animate-wave-4 ${isAnnouncement ? 'bg-blue-400' : 'bg-amber-400'}`}></div>
          <div className={`w-1.5 rounded-full animate-wave-5 ${isAnnouncement ? 'bg-blue-400' : 'bg-amber-400'}`}></div>
        </div>

        {/* Emergency Stop / Silence button */}
        <button
          onClick={() => audioEngine.stopPlayback()}
          className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          title="Emergency Stop Bell"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
        </button>
      </div>

      {/* Repeat sequence progress bar if in bell stage with multiple repeats */}
      {!isAnnouncement && playback.totalIterations > 1 && (
        <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-amber-500 h-full transition-all duration-300 rounded-full"
            style={{
              width: `${(playback.currentIteration / playback.totalIterations) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );
};
