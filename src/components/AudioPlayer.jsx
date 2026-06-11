import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

export default function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [waveformBars] = useState(() =>
    Array.from({ length: 28 }, () => 0.15 + Math.random() * 0.85)
  );

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
        setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
      }
    };
    const onEnded = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [isDragging]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); } else { audio.play(); }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = useCallback((e) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = x / rect.width;
    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
    setCurrentTime(audio.currentTime);
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      borderRadius: '14px',
      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1))',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      minWidth: '240px',
      maxWidth: '300px',
      backdropFilter: 'blur(8px)',
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        style={{
          width: '36px',
          height: '36px',
          minWidth: '36px',
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(139, 92, 246, 0.4)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {isPlaying
          ? <Pause size={16} strokeWidth={2.5} fill="#fff" />
          : <Play size={16} strokeWidth={2.5} fill="#fff" style={{ marginLeft: '2px' }} />
        }
      </button>

      {/* Waveform + Time */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>

        {/* Waveform bars */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5px',
            height: '28px',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          {waveformBars.map((h, i) => {
            const barProgress = (i / waveformBars.length) * 100;
            const isActive = barProgress < progress;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h * 100}%`,
                  minHeight: '3px',
                  borderRadius: '2px',
                  background: isActive
                    ? 'linear-gradient(180deg, #a78bfa, #8b5cf6)'
                    : 'rgba(148, 163, 184, 0.25)',
                  transition: 'background 0.15s ease',
                }}
              />
            );
          })}
        </div>

        {/* Time display */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: '10px',
            fontWeight: '500',
            color: 'var(--text-secondary, #94a3b8)',
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.3px',
          }}>
            {formatTime(currentTime)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Volume2 size={10} strokeWidth={2} color="rgba(139, 92, 246, 0.6)" />
            <span style={{
              fontSize: '10px',
              fontWeight: '500',
              color: 'var(--text-secondary, #94a3b8)',
              fontFamily: "'Inter', sans-serif",
              letterSpacing: '0.3px',
            }}>
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
