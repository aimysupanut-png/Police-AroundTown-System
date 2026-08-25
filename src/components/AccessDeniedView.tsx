import React from 'react';
import { Lock, ArrowLeft, Crown, UserCheck } from 'lucide-react';
import { Officer } from '../types';
import { AnimatedLogo } from './AnimatedLogo';

interface AccessDeniedViewProps {
  currentUser: Officer | null;
  onReturnDashboard: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  currentUser,
  onReturnDashboard,
}) => {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="bento-card bento-card-crimson p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Tactical Shield Emblem */}
        <div className="relative inline-flex items-center justify-center">
          <AnimatedLogo size="lg" animate={true} floating={true} colorCycling={true} spectrumSpeed={6} />
        </div>

        {/* Header Text */}
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-mono font-bold tracking-wider">
            <span>ERROR 403 &bull; RESTRICTED ACCESS</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            สิทธิ์การเข้าถึงถูกจำกัด (ACCESS DENIED)
          </h2>
          <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            หน้าต่างนี้สงวนไว้เฉพาะผู้ดูแลระบบระดับ <strong className="text-rose-400">Admin</strong> และฝ่ายบริหาร <strong className="text-amber-400">High Command (Leader)</strong> เท่านั้น
          </p>
        </div>

        {/* Current Officer Clearance Info */}
        <div className="p-4 rounded-2xl bg-[#080d18] border border-slate-800 max-w-md mx-auto text-left space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>ข้อมูลเจ้าหน้าที่ปัจจุบัน</span>
            <span className="text-[10px] font-mono text-rose-400">CLEARANCE: LEVEL 1 (MEMBER)</span>
          </div>

          <div className="flex items-center space-x-3 pt-1">
            {currentUser && (
              <img
                src={currentUser.avatar}
                alt={currentUser.officer_name}
                className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-700"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-100 truncate">
                {currentUser?.officer_name || 'Unknown Officer'}
              </p>
              <p className="text-xs text-slate-400">
                รหัสวิทยุ: <span className="text-amber-400 font-mono font-bold">#{currentUser?.badge_number}</span> &bull; {currentUser?.rank}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400">
              {currentUser?.role || 'Member'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            id="access-denied-return-btn"
            onClick={onReturnDashboard}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-950/60 border border-blue-400/40 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับสู่แดชบอร์ดหลัก</span>
          </button>
        </div>
      </div>
    </div>
  );
};
