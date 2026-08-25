import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Radio } from 'lucide-react';
import { AnimatedLogo } from './AnimatedLogo';

interface LoadingScreenProps {
  /** True when App.tsx has finished fetching initial data and the app is ready */
  isAppReady: boolean;
  /** Optional callback fired when loading screen has completely faded out */
  onFinish?: () => void;
  /** Custom video source URL if provided (default: /assets/loading-intro.mp4) */
  videoSrc?: string;
  /** Minimum duration in ms to showcase the intro animation (default: 2600ms) */
  minDuration?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isAppReady,
  onFinish,
  videoSrc = '/assets/loading-intro.mp4',
  minDuration = 6000,
}) => {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 1. Enforce minimum duration timer so user experiences the intro video smoothly
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration]);

  // 2. Absolute Fail-Safe Safety Timeout (Max 6.0s) to ensure website NEVER freezes
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (!isFadingOut && !isCompleted) {
        console.warn('[LoadingScreen] Safety timeout triggered. Fading into application...');
        triggerFadeOut();
      }
    }, 6000);

    return () => clearTimeout(safetyTimer);
  }, [isFadingOut, isCompleted]);

  // 3. Attempt autoplay on mount with robust mobile & desktop permissions handling
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.log('[LoadingScreen] Autoplay video note:', err?.message || err);
          // Don't crash; fallback CSS/Canvas visuals will seamlessly display underneath
        });
      }
    }
  }, []);

  // 4. Trigger Fade Out sequence
  const triggerFadeOut = useCallback(() => {
    if (isFadingOut || isCompleted) return;
    setIsFadingOut(true);

    // After fade duration (750ms), permanently remove loading screen from DOM
    setTimeout(() => {
      setIsCompleted(true);
      if (onFinish) onFinish();
    }, 750);
  }, [isFadingOut, isCompleted, onFinish]);

  // 5. Watch for both conditions: (minTimeElapsed OR video played) AND isAppReady
  useEffect(() => {
    if (isAppReady && minTimeElapsed && !isFadingOut && !isCompleted) {
      triggerFadeOut();
    }
  }, [isAppReady, minTimeElapsed, isFadingOut, isCompleted, triggerFadeOut]);

  // If completed, do not render anything in DOM
  if (isCompleted) {
    return null;
  }

  return (
    <div
      id="app-loading-screen"
      role="status"
      aria-live="polite"
      aria-label="Loading Around Town Police Department MDT"
      className={`fixed inset-0 z-[99999] bg-black select-none overflow-hidden transition-opacity duration-700 ease-in-out pointer-events-auto ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
      }}
    >
      {/* Background Deep Space Cosmic Fallback / Underlay (Matches Uploaded Video Aesthetic) */}
      <div className="absolute inset-0 bg-[#020208] flex items-center justify-center overflow-hidden">
        {/* Dynamic Glowing Nebula Clouds */}
        <div 
          className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] rounded-full blur-3xl opacity-40 animate-pulse pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(219,39,119,0.35) 0%, rgba(99,102,241,0.25) 45%, rgba(6,182,212,0.15) 75%, transparent 100%)',
            animationDuration: '4s'
          }}
        />

        {/* Space Star Dust Particles */}
        <div className="absolute inset-0 bg-tactical-grid opacity-25 pointer-events-none" />

        {/* Official Police Around Town Animated Neon Logo Display */}
        {(!isVideoLoaded || videoError) && (
          <div className="relative flex flex-col items-center justify-center z-10 px-4 text-center">
            {/* Centered Animated Logo */}
            <div className="relative mb-6">
              <AnimatedLogo
                size="hero"
                animate={true}
                floating={true}
                colorCycling={true}
                lightSweep={true}
                spectrumSpeed={7}
              />
            </div>

            {/* Glowing Brand Title */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] sm:text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
                <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-spin" style={{ animationDuration: '3s' }} />
                <span>AROUND TOWN POLICE DEPARTMENT</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-widest uppercase drop-shadow-lg">
                MOBILE DATA TERMINAL
              </h1>
              <p className="text-[11px] sm:text-xs font-mono text-slate-400 animate-pulse">
                INITIALIZING SECURE POLICE NETWORK • STANDBY...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Primary Video Player Element (Full Screen, Cover, Autoplay, Loop, Muted, PlaysInline) */}
      {!videoError && (
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          muted
          playsInline
          loop
          preload="auto"
          controls={false}
          onLoadedData={() => {
            setIsVideoLoaded(true);
          }}
          onCanPlayThrough={() => {
            setIsVideoLoaded(true);
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }}
          onError={(e) => {
            console.log('[LoadingScreen] Video file not available at src, activating smooth SVG/CSS animation fallback.');
            setVideoError(true);
          }}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${
            isVideoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      )}

      {/* Bottom Loading Progress Status Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
        <div className="w-48 sm:w-64 h-1 rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/50 backdrop-blur-md">
          <div 
            className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 rounded-full animate-pulse"
            style={{
              width: isAppReady ? '100%' : '75%',
              transition: 'width 0.4s ease-out'
            }}
          />
        </div>
        <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-400 uppercase">
          {isAppReady ? 'READY • ENTERING SYSTEM' : 'CONNECTING TO MDT SERVICES...'}
        </span>
      </div>
    </div>
  );
};
