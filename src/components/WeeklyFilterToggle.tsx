import React from 'react';
import { Calendar, Globe, ChevronLeft, ChevronRight, Clock, Info } from 'lucide-react';
import { WeeklyRange } from '../utils/dateUtils';

interface WeeklyFilterToggleProps {
  mode: 'week' | 'all';
  onChangeMode: (mode: 'week' | 'all') => void;
  weeklyRange: WeeklyRange;
  weekOffset?: number;
  onChangeWeekOffset?: (offset: number) => void;
  compact?: boolean;
  className?: string;
  showWeekNav?: boolean;
}

export const WeeklyFilterToggle: React.FC<WeeklyFilterToggleProps> = ({
  mode,
  onChangeMode,
  weeklyRange,
  weekOffset = 0,
  onChangeWeekOffset,
  compact = false,
  className = '',
  showWeekNav = true,
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-2 ${className}`}>
      {/* Segmented Control */}
      <div className="inline-flex p-1 rounded-xl bg-slate-900/90 border border-slate-800 shadow-inner">
        <button
          type="button"
          onClick={() => onChangeMode('week')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
            mode === 'week'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>รายสัปดาห์ (Weekly)</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeMode('all')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
            mode === 'all'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>ทั้งหมด (All Time)</span>
        </button>
      </div>

      {/* Weekly Cycle Indicator & Range details */}
      {mode === 'week' && (
        <div className="flex items-center flex-wrap gap-1.5">
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold shadow-sm">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{weeklyRange.formattedRange}</span>
          </div>

          {/* Week navigation (Previous / Current / Next) */}
          {showWeekNav && onChangeWeekOffset && (
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => onChangeWeekOffset(weekOffset - 1)}
                className="p-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-400 text-xs transition-colors cursor-pointer"
                title="สัปดาห์ก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {weekOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => onChangeWeekOffset(0)}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] font-black text-amber-300 transition-colors cursor-pointer"
                >
                  กลับสัปดาห์นี้
                </button>
              )}

              <button
                type="button"
                onClick={() => onChangeWeekOffset(weekOffset + 1)}
                className="p-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-400 text-xs transition-colors cursor-pointer"
                title="สัปดาห์ถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'all' && !compact && (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs font-mono">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>คำนวณจากประวัติการทำงานสะสมทั้งหมดตั้งแต่เริ่มระบบ</span>
        </div>
      )}
    </div>
  );
};
