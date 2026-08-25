import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  Radio, 
  ChevronRight,
  Sparkles,
  Crown,
  UserCheck,
  FlaskConical,
  ArrowRight,
  Sliders,
  ChevronDown
} from 'lucide-react';
import { Officer } from '../types';
import { AnimatedLogo } from './AnimatedLogo';

interface DiscordLoginViewProps {
  availableUsers: Officer[];
  onLoginSuccess: (officer: Officer) => void;
  onShowToast: (text: string, type: 'success' | 'warning' | 'info') => void;
}

export const DiscordLoginView: React.FC<DiscordLoginViewProps> = ({
  onLoginSuccess,
  onShowToast
}) => {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isTestLoggingIn, setIsTestLoggingIn] = useState(false);
  const [showCustomTestForm, setShowCustomTestForm] = useState(false);

  // Custom test form state
  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState<'Leader' | 'Admin' | 'Member'>('Leader');
  const [customDiscordId, setCustomDiscordId] = useState('');

  // Direct login with Discord OAuth2: Redirect to server authorization route
  const handleDiscordLogin = () => {
    setIsRedirecting(true);
    window.location.href = '/auth/discord';
  };

  // Test Sandbox Quick-Login to enter Dashboard
  const handleTestLogin = async (role: 'Leader' | 'Member', name?: string, customId?: string) => {
    setIsTestLoggingIn(true);
    try {
      const res = await fetch('/api/auth/test-sandbox-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          officer_name: name,
          discord_id: customId
        })
      });

      const data = await res.json();
      if (res.ok && data.user) {
        onShowToast(data.message || `เข้าสู่ Dashboard ทดสอบสำเร็จ (${data.user.role})`, 'success');
        onLoginSuccess(data.user);
      } else {
        onShowToast(data.error || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบทดสอบ', 'warning');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Server error', 'warning');
    } finally {
      setIsTestLoggingIn(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleTestLogin(
      customRole === 'Leader' || customRole === 'Admin' ? 'Leader' : 'Member',
      customName.trim() || undefined,
      customDiscordId.trim() || undefined
    );
  };

  return (
    <div className="min-h-[92vh] flex flex-col items-center justify-center p-4 sm:p-8 relative selection:bg-indigo-500 selection:text-white">
      {/* Background Ambience & Cyber Grid Highlights */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-12 right-12 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-12 left-12 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 space-y-6">
        
        {/* ========================================================================= */}
        {/* POLICE BADGE & HEADER BRANDING */}
        {/* ========================================================================= */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-blue-500/30 text-blue-300 text-xs font-mono font-bold shadow-xl shadow-blue-950/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            <span>POLICE AROUND TOWN DEPARTMENT &bull; SEKROLEPLAY</span>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-3 flex items-center justify-center">
              <AnimatedLogo
                size="hero"
                animate={true}
                floating={true}
                colorCycling={true}
                lightSweep={true}
                spectrumSpeed={8}
              />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>สถานีตำรวจ</span>
              <span className="text-amber-400 font-mono">ARPD</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mt-1 font-medium text-center">
              ศูนย์รวมระบบตำรวจจัดทำโดย SEKROLEPLAY
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN LOGIN AUTHENTICATION CARD */}
        {/* ========================================================================= */}
        <div className="bg-[#090d16]/95 border border-slate-700/70 rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-2xl space-y-6 relative overflow-hidden">
          
          {/* Top Status Bar */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Discord OAuth2 Gateway</span>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono font-bold">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Official MDT Portal</span>
            </span>
          </div>

          {/* ========================================================================= */}
          {/* PRIMARY ACTION: LOGIN WITH REAL DISCORD */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            <button
              id="btn-discord-oauth-login"
              disabled={isRedirecting || isTestLoggingIn}
              onClick={handleDiscordLogin}
              className="w-full py-4 px-6 rounded-2xl bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3c45a5] text-white font-bold text-base shadow-2xl shadow-[#5865F2]/40 transition-all transform active:scale-[0.99] flex items-center justify-center space-x-3 cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isRedirecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>กำลังเชื่อมต่อไปยัง Discord OAuth2...</span>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                  <span>Login with Discord</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-slate-400">
              เมื่อกดปุ่ม ระบบจะนำท่านไปยังหน้า Discord OAuth2 เพื่อยืนยันสิทธิ์และเข้าใช้งานระบบ MDT ทันที
            </p>
          </div>

          {/* System Telemetry & Footer */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>TLS 1.3 &bull; AES-256 MDT Encryption</span>
            </div>
            <span>Around Town Police Dept.</span>
          </div>

        </div>

      </div>
    </div>
  );
};
