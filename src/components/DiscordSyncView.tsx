import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  Bot, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Hash, 
  ShieldAlert, 
  Clock, 
  Database,
  ArrowRight,
  Code
} from 'lucide-react';
import { Officer, CaseLog, DutyLog } from '../types';

interface DiscordSyncViewProps {
  currentUser: Officer;
  cases: CaseLog[];
  dutyLogs: DutyLog[];
  onParseDiscordLog: (rawText: string) => Promise<any>;
}

export const DiscordSyncView: React.FC<DiscordSyncViewProps> = ({
  currentUser,
  cases,
  dutyLogs,
  onParseDiscordLog,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'all' | '#case-logs-normal' | '#case-logs-take2' | '#case-logs-red' | '#duty-logs'>('all');
  const [rawInput, setRawInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  const presets = [
    {
      label: '🚨 คดีแดง: ปล้นธนาคาร (Red Case)',
      text: `[CASE-LOG] Officer Alex Vance (01) - Red Case - ปล้นธนาคารพาณิชย์ & ยิงปะทะเจ้าหน้าที่ SWAT`
    },
    {
      label: '⚠️ เคส TAKE2: ขับรถหนี (Take2 Case)',
      text: `[CASE-LOG] Officer Marcus Brody (05) - TAKE2 - 10-80 หลบหนีการจับกุม ยอมจำนนและชดใช้ค่าเสียหาย`
    },
    {
      label: '📋 เคสปกติ: ลักทรัพย์ร้านค้า (Normal Case)',
      text: `[CASE-LOG] Officer Ryan King (12) - Normal - 10-16 ลักทรัพย์ร้านสะดวกซื้อ 24/7`
    },
    {
      label: '🟢 เข้าเวร: Clock-In Log',
      text: `เข้าเวร: Sarah Croft (08) ประจำการสถานี Mission Row เวลา 20:00`
    },
    {
      label: '🔴 ออกเวร: Clock-Out Log',
      text: `ออกเวร: James Cole (15) สิ้นสุดเวรปฏิบัติการ`
    }
  ];

  const handleSendParse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rawInput.trim()) return;

    setIsProcessing(true);
    try {
      const res = await onParseDiscordLog(rawInput);
      setLastSyncResult(res);
      setRawInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyPreset = (text: string) => {
    setRawInput(text);
  };

  const normalCases = cases.filter(c => c.case_type === 'Normal');
  const take2Cases = cases.filter(c => c.case_type === 'Take2');
  const redCases = cases.filter(c => c.case_type === 'Red');

  return (
    <div className="space-y-6">
      
      {/* Admin Clearance Alert Bar */}
      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-gradient-to-r from-rose-950/60 via-indigo-950/40 to-slate-900 border border-rose-500/40 text-xs shadow-sm">
        <div className="flex items-center space-x-2 text-rose-300 font-bold">
          <Bot className="w-4 h-4 text-indigo-400" />
          <span className="uppercase tracking-wider">ADMIN COMMAND &bull; โครงสร้างบอทและระบบดึงข้อมูลจาก DISCORD LOG</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-indigo-600/80 text-white font-mono text-[10px] font-bold">
          BOT INFRASTRUCTURE
        </span>
      </div>

      {/* Header Banner */}
      <div className="bento-card bento-card-crimson p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-black uppercase tracking-wider mb-1">
            <MessageSquare className="w-4 h-4" />
            <span>DISCORD BOT & WEBHOOK INTEGRATION LAYER</span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            ระบบดักจับ & Sync ข้อมูลอัตโนมัติจาก Discord
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ดักจับ Log การบันทึกคดีแยกหมวดหมู่ (เคสปกติ, TAKE2, คดีแดง) และ Log การเข้าเวร/ออกเวร (Clock-in / Clock-out)
          </p>
        </div>

        {/* Discord Bot Status Card */}
        <div className="flex items-center space-x-3 bg-slate-950/90 px-4 py-2.5 rounded-xl border border-indigo-500/40 shadow-md">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <div>
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-indigo-400" /> AroundTown-MDT Bot
            </p>
            <p className="text-[10px] text-emerald-400 font-mono">Webhook: Active & Listening</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Discord Log Parser Simulator & Channel Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 cols): Interactive Webhook Simulator */}
        <div className="lg:col-span-2 space-y-4">
          
          <div className="bento-card bento-card-blue p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">ทดสอบส่งข้อความจำลองจาก Discord (Webhook Ingestion Simulator)</h3>
              </div>
              <span className="text-[11px] text-slate-400">รองรับข้อความภาษาไทย & รหัสวิทยุ</span>
            </div>

            {/* Presets Button Row */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-400 font-semibold">เลือกตัวอย่างข้อความด่วน (Quick Presets):</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p.text)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-700/80 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendParse} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  วางข้อความ Log ที่ต้องการดักจับ (Discord Message / Embed Raw Text)
                </label>
                <textarea
                  rows={3}
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="เช่น [CASE-LOG] Officer Marcus Brody (05) - Red Case - ปล้นธนาคาร หรือ เข้าเวร: Sarah Croft (08)"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  ระบบจะทำการ Parse ชื่อตำรวจ, รหัสเรียกขาน, ชนิดคดี, และตรวจสอบความสอดคล้องอัตโนมัติ
                </span>

                <button
                  type="submit"
                  disabled={isProcessing || !rawInput.trim()}
                  className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-950/50 transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'กำลังประมวลผล...' : 'ส่งเข้า Webhook'}</span>
                </button>
              </div>
            </form>

            {/* Parsed Result Display */}
            {lastSyncResult && (
              <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/40 text-xs space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> {lastSyncResult.message || 'บันทึกข้อมูลเข้าสู่ระบบ MDT สำเร็จ'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Status: 200 OK</span>
                </div>
                {lastSyncResult.parsed && (
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono space-y-1">
                    <p>เลขคดี: <span className="text-amber-400">{lastSyncResult.parsed.case_number}</span></p>
                    <p>เจ้าหน้าที่: <span className="text-white">{lastSyncResult.parsed.officer_name} (#{lastSyncResult.parsed.badge_number})</span></p>
                    <p>หมวดหมู่: <span className={lastSyncResult.parsed.case_type === 'Red' ? 'text-rose-400' : 'text-blue-400'}>{lastSyncResult.parsed.case_type}</span></p>
                    {lastSyncResult.parsed.is_anomaly && (
                      <p className="text-rose-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> ตรวจพบความผิดปกติ: นอกเวลาปฏิบัติหน้าที่
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sync Stats Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bento-card bento-card-blue p-4">
              <span className="text-xs text-blue-300 font-medium">#case-logs-normal</span>
              <div className="text-xl font-mono font-black text-white mt-1">{normalCases.length} เคส</div>
              <p className="text-[10px] text-slate-500">Sync ล่าสุด 5 นาทีที่แล้ว</p>
            </div>
            <div className="bento-card bento-card-gold p-4">
              <span className="text-xs text-amber-300 font-medium">#case-logs-take2</span>
              <div className="text-xl font-mono font-black text-amber-400 mt-1">{take2Cases.length} เคส</div>
              <p className="text-[10px] text-slate-500">Sync ล่าสุด 10 นาทีที่แล้ว</p>
            </div>
            <div className="bento-card bento-card-crimson p-4">
              <span className="text-xs text-rose-300 font-medium">#case-logs-red</span>
              <div className="text-xl font-mono font-black text-rose-400 mt-1">{redCases.length} เคส</div>
              <p className="text-[10px] text-slate-500">Sync ล่าสุด 2 นาทีที่แล้ว</p>
            </div>
          </div>

        </div>

        {/* Right Column: Live Stream of Discord Channels */}
        <div className="space-y-4">
          <div className="bento-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Hash className="w-4 h-4 text-indigo-400" /> DISCORD CHANNEL FEED
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono">&bull; Live Sync</span>
            </div>

            {/* Channel Filters */}
            <div className="flex space-x-1 overflow-x-auto pb-1 text-xs">
              {(['all', '#case-logs-normal', '#case-logs-take2', '#case-logs-red', '#duty-logs'] as const).map(ch => (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer ${
                    selectedChannel === ch ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            {/* Simulated Discord Message Cards */}
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {cases.slice(0, 10).map(c => {
                if (selectedChannel !== 'all' && c.discord_channel !== selectedChannel) return null;

                return (
                  <div key={c.id} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-indigo-300">{c.officer_name}</span>
                        <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-800 text-amber-300">#{c.badge_number}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{c.timestamp.split(' ')[1]}</span>
                    </div>

                    <div className="p-2 rounded bg-slate-950 border-l-2 border-indigo-500 text-[11px] text-slate-300 font-mono">
                      <p className="text-white font-bold">{c.case_number}: {c.title}</p>
                      <p className="text-[10px] text-slate-400">หมวดหมู่: <span className={c.case_type === 'Red' ? 'text-rose-400' : 'text-blue-400'}>{c.case_type}</span> | ผู้ต้องหา: {c.suspect_name}</p>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                      <span>{c.discord_channel}</span>
                      <span>Msg ID: {c.discord_msg_id?.slice(0, 10)}...</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
