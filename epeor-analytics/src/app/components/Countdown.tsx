"use client";

import React from "react";

interface Props {
  secondsLeft: number;
  totalSeconds: number;
}

function formatTime(s: number) {
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function Countdown({ secondsLeft, totalSeconds }: Props) {
  const clamped = Math.max(0, Math.min(secondsLeft, totalSeconds));
  const progress = Math.max(0, Math.min(1, (totalSeconds - clamped) / totalSeconds));

  const stroke = 10;
  const size = 112; // larger and more prominent
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - progress * circumference;

  const urgent = clamped <= 10 && clamped > 0;

  return (
    <div className="space-y-3 pt-3 border-t border-rose-100">
      <div className="flex items-center justify-center">
        <div className={`relative w-28 h-28 ${urgent ? 'animate-pulse' : ''}`}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <defs>
              <linearGradient id="g1" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#0EA5E9" />
                <stop offset="100%" stopColor="#0B72C2" />
              </linearGradient>
            </defs>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#F3F4F6"
              strokeWidth={stroke}
              fill="none"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="url(#g1)"
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={String(dashOffset)}
              style={{ transition: "stroke-dashoffset 400ms linear, stroke 200ms" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Compte à rebours</p>
              <div
                className={`text-3xl md:text-4xl font-black ${urgent ? 'text-rose-700' : 'text-slate-800'} font-mono tracking-tighter`}
                aria-live="polite"
              >
                {formatTime(clamped)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-400 ease-linear ${urgent ? 'bg-rose-600' : 'bg-gradient-to-r from-sky-500 to-blue-600'}`}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <p className="text-xs text-slate-700 text-center font-medium">Veuillez attendre avant de réessayer</p>

      <div className="sr-only" role="progressbar" aria-valuemin={0} aria-valuemax={totalSeconds} aria-valuenow={secondsLeft}>
        {`Temps restant: ${formatTime(clamped)}`}
      </div>
    </div>
  );
}
