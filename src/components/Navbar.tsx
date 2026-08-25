import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Radio, 
  Clock, 
  UserCheck, 
  UserX, 
  ChevronDown, 
  Activity, 
  DollarSign, 
  AlertTriangle, 
  Users, 
  MessageSquare,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Crown,
  KeyRound,
  X,
  ExternalLink,
  Bot,
  FileSpreadsheet,
  CheckCircle2,
  Lock,
  Search,
  LogOut,
  PlusCircle,
  FileText,
  Bell
} from 'lucide-react';
import { AnimatedLogo } from './AnimatedLogo';
import { Officer, DutyLog } from '../types';

interface NavbarProps {
  currentUser: Officer | null;
  availableUsers?: Officer[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSwitchUser?: (discordId: string) => void;
  onLogout?: () => void;
  onToggleDuty: () => void;
  anomaliesCount: number;
  pendingBadgesCount: number;
  notificationsCount?: number;
  onOpenCheckerModal?: () => void;
  dutyLogs?: DutyLog[];
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  availableUsers = [],
  activeTab,
  setActiveTab,
  onLogout,
  onToggleDuty,
  anomaliesCount,
  pendingBadgesCount,
  notificationsCount = 0,
  onOpenCheckerModal,
  dutyLogs = [],
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdminHub, setShowAdminHub] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [dutyTimer, setDutyTimer] = useState<string>('00:00:00');
  const adminHubRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('th-TH', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Real-time Duty timer counting accurately from actual clock-in timestamp
  useEffect(() => {
    const isOnDuty = currentUser?.status === 'On Duty' || currentUser?.status === 'In Action';
    if (isOnDuty && currentUser) {
      const activeDuty = dutyLogs.find(d => d.officer_discord_id === currentUser.discord_id && d.is_active);
      let startMs = activeDuty?.clock_in_timestamp;
      if (!startMs && activeDuty?.clock_in_iso) {
        startMs = new Date(activeDuty.clock_in_iso).getTime();
      }
      if (!startMs && activeDuty?.clock_in) {
        startMs = new Date(activeDuty.clock_in.replace(' ', 'T')).getTime();
        if (isNaN(startMs)) {
          startMs = new Date(activeDuty.clock_in).getTime();
        }
      }
      if (!startMs || isNaN(startMs)) {
        startMs = Date.now();
      }

      const updateDuty = () => {
        const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs!) / 1000));
        const hrs = Math.floor(elapsedSec / 3600).toString().padStart(2, '0');
        const mins = Math.floor((elapsedSec % 3600) / 60).toString().padStart(2, '0');
        const secs = (elapsedSec % 60).toString().padStart(2, '0');
        setDutyTimer(`${hrs}:${mins}:${secs}`);
      };

      updateDuty();
      const timer = setInterval(updateDuty, 1000);
      return () => clearInterval(timer);
    } else {
      setDutyTimer('00:00:00');
    }
  }, [currentUser?.status, currentUser?.discord_id, dutyLogs]);

  // Close admin hub & user menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminHubRef.current && !adminHubRef.current.contains(event.target as Node)) {
        setShowAdminHub(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showAdminHub || showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAdminHub, showUserMenu]);

  const isLeaderOrAdmin = currentUser?.role === 'Leader' || currentUser?.role === 'Admin';

  // 1. Officer Operations (เมนูหลักสำหรับเจ้าหน้าที่ทุกคน)
  const officerNavItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: Shield, badge: 0, desc: 'ภาพรวม & สถานะเวร' },
    { id: 'cases-create', label: '➕ ลงเคส', icon: PlusCircle, badge: 0, desc: 'บันทึกคดีใหม่ แนบภาพหลักฐาน & แท็กตำรวจ' },
    { id: 'cases', label: '📋 ประวัติการลงเคส', icon: FileText, badge: 0, desc: 'คลังประวัติคดีทั้งหมด & ค้นหา' },
    { id: 'notifications', label: '🔔 การแจ้งเตือน', icon: Bell, badge: notificationsCount, desc: 'การแจ้งเตือนคดี & แท็ก' },
    { id: 'badges', label: 'ผังรหัสวิทยุ / Badge', icon: Radio, badge: isLeaderOrAdmin ? pendingBadgesCount : 0, desc: 'ตรวจสอบ & ยื่นขอเลข' },
    { id: 'activities', label: 'กิจกรรม & ฝึกอบรม', icon: Activity, badge: 0, desc: 'โหวตภารกิจ & ทำข้อสอบ SOP' },
  ];

  // 2. Admin & Leadership Functions (ฟังก์ชั่นผู้ดูแลระบบ)
  const adminNavItems = [
    { 
      id: 'all-officers', 
      label: 'ทำเนียบรายชื่อทั้งหมด (Master Directory)', 
      shortLabel: 'รายชื่อทั้งหมด',
      icon: Users, 
      badge: availableUsers.length || 0, 
      desc: 'หน้ารายชื่อตำรวจทั้งหมดในระบบ ค้นหา คัดกรอง แยกแผนก แฟ้มประวัติ และส่งออก Excel',
      color: 'emerald',
      tag: 'DIRECTORY'
    },
    { 
      id: 'payroll', 
      label: 'คำนวณเบี้ยเลี้ยง (Excel Payroll)', 
      shortLabel: 'คำนวณเบี้ยเลี้ยง',
      icon: DollarSign, 
      badge: 0, 
      desc: 'ตั้งสูตรตัวคูณรายเคส สรุปยอดจ่าย และส่งออกไฟล์ .xlsx / CSV',
      color: 'gold',
      tag: 'FINANCE'
    },
    { 
      id: 'validation', 
      label: 'ตรวจสอบความสอดคล้อง (Discrepancy Audit)', 
      shortLabel: 'ตรวจสอบความสอดคล้อง',
      icon: AlertTriangle, 
      badge: anomaliesCount, 
      desc: 'สแกนความผิดปกติระหว่าง Case Logs กับ Duty Logs แบบเรียลไทม์',
      color: 'crimson',
      tag: 'SECURITY'
    },
    { 
      id: 'admin', 
      label: 'ศูนย์บริหารงานสถานี (Admin Control)', 
      shortLabel: 'ศูนย์บริหารสถานี',
      icon: ShieldCheck, 
      badge: 0, 
      desc: 'ภาพรวมกำลังพล สถิติทั้งสถานี และบันทึกประวัติ Audit Trail',
      color: 'gold',
      tag: 'COMMAND'
    },
  ];

  const isOnDuty = currentUser?.status === 'On Duty' || currentUser?.status === 'In Action';
  const activeAdminItem = adminNavItems.find(i => i.id === activeTab);
  const isCurrentTabAdmin = Boolean(activeAdminItem);
  const totalAdminAlerts = anomaliesCount + (isLeaderOrAdmin ? pendingBadgesCount : 0);

  const handleSelectAdminTab = (tabId: string) => {
    setActiveTab(tabId);
    setShowAdminHub(false);
  };

  return (
    <header className="bg-[#070b14]/95 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-50 shadow-xl shadow-black/30">
      {/* Top Banner / Tactical HUD */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-4">
          
          {/* Logo & Department Branding */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group py-1"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="relative flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <AnimatedLogo
                size="sm"
                animate={true}
                floating={true}
                colorCycling={true}
                lightSweep={true}
                spectrumSpeed={8}
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-black tracking-wider text-white uppercase group-hover:text-cyan-300 transition-colors">
                  AROUND TOWN
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-950/80 text-rose-300 font-mono font-bold border border-rose-700/60 shadow-sm">
                  MDT v4.2
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
                POLICE DEPARTMENT &bull; BY SEKROLEPLAY
              </p>
            </div>
          </div>

          {/* Center Tactical Status: Live Server Clock & Duty Status & Quick Tools */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-inner backdrop-blur-md">
              
              {/* Live Server Clock */}
              <div className="hidden md:flex items-center space-x-2 text-xs">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400 font-medium hidden xl:inline">เวลาสถานี:</span>
                <span className="font-mono font-bold text-amber-300 tracking-wider">{currentTime}</span>
              </div>

              <div className="hidden md:block h-4 w-px bg-slate-800" />

              {/* Quick Clock-in / Clock-out Button (Admin Duty Compact Button: เข้าเวร / ออกเวร) */}
              <button
                id="duty-toggle-btn"
                onClick={onToggleDuty}
                title={isOnDuty ? "คลิกเพื่อลงชื่อออกเวร" : "คลิกเพื่อลงชื่อเข้าเวร"}
                className={`whitespace-nowrap flex-shrink-0 inline-flex items-center space-x-1.5 px-3 py-1.5 h-7 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer select-none ${
                  isOnDuty
                    ? 'bg-rose-950/80 hover:bg-rose-900/90 text-rose-200 hover:text-white border border-rose-500/50 shadow-rose-950/40'
                    : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-500/50 shadow-emerald-950/30'
                }`}
              >
                {isOnDuty ? (
                  <>
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400"></span>
                    </span>
                    <UserX className="w-3.5 h-3.5 text-rose-300 flex-shrink-0" />
                    <span className="whitespace-nowrap">ออกเวร</span>
                    <span className="font-mono bg-rose-900/60 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] text-rose-200 border border-rose-500/40 font-bold ml-1 whitespace-nowrap">
                      {dutyTimer}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="whitespace-nowrap">เข้าเวร</span>
                  </>
                )}
              </button>

              {/* Quick Name Existence Checker Button - Admin / Leader Only */}
              {isLeaderOrAdmin && onOpenCheckerModal && (
                <>
                  <div className="hidden sm:block h-4 w-px bg-slate-800" />
                  <button
                    onClick={onOpenCheckerModal}
                    className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-cyan-950/50 hover:bg-cyan-900/70 border border-cyan-500/40 hover:border-cyan-400/70 text-cyan-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                    title="ตรวจสอบว่ารายชื่อเจ้าหน้าที่นี้มีอยู่ในระบบสถานีหรือไม่ (เฉพาะ Admin)"
                  >
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ตรวจรายชื่อ</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Section: Clearance Pill & User Switcher Profile */}
          <div className="flex items-center gap-3">
            
            {/* Clearance Pill */}
            <div className={`hidden sm:flex px-3 py-1.5 rounded-xl border text-xs font-bold items-center gap-1.5 shadow-sm ${
              isLeaderOrAdmin 
                ? 'bg-gradient-to-r from-rose-950/70 via-amber-950/50 to-rose-950/70 border-rose-500/40 text-rose-200' 
                : 'bg-slate-900/90 border-slate-700/80 text-slate-300'
            }`}>
              {isLeaderOrAdmin ? (
                <>
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin Clearance</span>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Officer Mode</span>
                </>
              )}
            </div>

            {/* Officer Profile & Logout Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                id="user-menu-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center space-x-3 px-3 py-1.5 rounded-2xl border transition-all text-left group cursor-pointer shadow-sm ${
                  isLeaderOrAdmin 
                    ? 'bg-slate-900/90 hover:bg-slate-850 border-rose-500/40 hover:border-amber-400/80' 
                    : 'bg-slate-900/90 hover:bg-slate-850 border-slate-700/80 hover:border-slate-500'
                }`}
              >
                <div className="relative">
                  <img
                    src={currentUser?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                    alt={currentUser?.officer_name}
                    className={`w-8 h-8 rounded-xl object-cover ring-2 ${isLeaderOrAdmin ? 'ring-rose-500/70' : 'ring-slate-600'}`}
                  />
                  <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${isOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                </div>
                <div className="hidden sm:block">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                      {currentUser?.officer_name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      #{currentUser?.badge_number}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 mt-0.5">
                    <span className={`text-[10px] font-semibold ${
                      currentUser?.role === 'Leader' ? 'text-rose-400' : currentUser?.role === 'Admin' ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                      {currentUser?.rank} &bull; {currentUser?.role === 'Leader' ? '👑 Leader' : currentUser?.role === 'Admin' ? '🛡️ Admin' : '👮 Member'}
                    </span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-transform duration-200 ml-1 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

            {/* Officer Account Details & Logout Dropdown */}
            {showUserMenu && currentUser && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#0c1322] border border-slate-700 shadow-2xl z-50 py-3 divide-y divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
                {/* Officer Profile Summary */}
                <div className="px-4 py-2">
                  <div className="flex items-center space-x-3 mb-3">
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.officer_name}
                      className={`w-12 h-12 rounded-xl object-cover ring-2 ${isLeaderOrAdmin ? 'ring-rose-500' : 'ring-blue-500'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <p className="text-sm font-bold text-slate-100 truncate">{currentUser.officer_name}</p>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          #{currentUser.badge_number}
                        </span>
                      </div>
                      <p className={`text-xs font-semibold mt-0.5 ${
                        currentUser.role === 'Leader' ? 'text-rose-400' : currentUser.role === 'Admin' ? 'text-amber-400' : 'text-blue-400'
                      }`}>
                        {currentUser.rank} &bull; {currentUser.role === 'Leader' ? '👑 Leader' : currentUser.role === 'Admin' ? '🛡️ Admin' : '👮 Member'}
                      </p>
                    </div>
                  </div>

                  {/* Officer Info Pills */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">สังกัดแผนก:</span>
                      <span className="font-semibold text-slate-200 truncate block">{currentUser.department || 'Patrol Division'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">รหัสเรียกขาน:</span>
                      <span className="font-mono font-bold text-amber-300 truncate block">{currentUser.callsign || `UNIT-${currentUser.badge_number}`}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">สถานะเวร:</span>
                      <span className={`font-semibold flex items-center gap-1 ${isOnDuty ? 'text-emerald-400' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {isOnDuty ? 'กำลังปฏิบัติหน้าที่' : 'ออกเวร'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Discord ID:</span>
                      <span className="font-mono text-slate-400 text-[10px] truncate block" title={currentUser.discord_id}>
                        {currentUser.discord_id ? `${currentUser.discord_id.slice(0, 6)}...` : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Logout Action */}
                <div className="p-3 bg-slate-950/90 space-y-2">
                  {onLogout && (
                    <button
                      id="navbar-logout-btn"
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-2.5 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold text-rose-200 hover:text-white bg-gradient-to-r from-rose-900/60 to-red-950/80 hover:from-rose-600 hover:to-red-700 border border-rose-500/40 shadow-lg shadow-rose-950/40 transition-all cursor-pointer group"
                    >
                      <LogOut className="w-4 h-4 text-rose-400 group-hover:text-white transition-colors" />
                      <span>ออกจากระบบ (Logout)</span>
                    </button>
                  )}

                  <div className="px-1 text-[10px] text-slate-500 flex items-center justify-between">
                    <span>Discord OAuth2: เชื่อมต่อแล้ว</span>
                    <span className="text-emerald-400 font-mono text-[9px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Online
                    </span>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPACT & BEAUTIFUL MAIN NAVIGATION BAR (SPACIOUS, NO OVERFLOW, POLISHED) */}
      {/* ========================================================================= */}
      <div className="bg-[#050811]/90 border-t border-slate-800/80 py-2.5 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* LEFT: Officer Nav Tabs */}
          <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {officerNavItems.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-950/60 border border-blue-400/50 ring-1 ring-blue-400/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border border-slate-800/60 hover:border-slate-700/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-slate-950 ml-1">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* RIGHT: ADMIN MENU BUTTON (CLICK TO OPEN ADMIN COMMAND HUB) - ADMINS ONLY */}
          {isLeaderOrAdmin ? (
            <div className="relative flex-shrink-0" ref={adminHubRef}>
              <button
                id="admin-hub-trigger-btn"
                onClick={() => setShowAdminHub(!showAdminHub)}
                className={`flex items-center space-x-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md whitespace-nowrap ${
                  isCurrentTabAdmin
                    ? 'bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 text-white border border-rose-400/80 admin-badge-glow shadow-rose-950/60'
                    : showAdminHub
                    ? 'bg-rose-950 text-rose-200 border border-rose-500 shadow-rose-950/80'
                    : 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-amber-950/60 text-rose-300 hover:text-white border border-rose-800/60 hover:border-rose-500 shadow-slate-950/50'
                }`}
              >
                <Crown className={`w-4 h-4 ${isCurrentTabAdmin ? 'text-amber-300 animate-pulse' : 'text-amber-400'}`} />
                
                <div className="flex items-center space-x-1.5">
                  <span>{isCurrentTabAdmin && activeAdminItem ? `Admin: ${activeAdminItem.shortLabel}` : 'เมนูแอดมิน (Admin Center)'}</span>
                  
                  {totalAdminAlerts > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white animate-pulse">
                      {totalAdminAlerts}
                    </span>
                  )}
                </div>

                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdminHub ? 'rotate-180 text-amber-400' : 'text-rose-300'}`} />
              </button>

              {/* ========================================================================= */}
              {/* ADMIN COMMAND HUB MODAL / MEGA DROPDOWN */}
              {/* ========================================================================= */}
              {showAdminHub && (
                <div className="absolute right-0 mt-3 w-[92vw] sm:w-[540px] md:w-[620px] rounded-2xl bg-[#090e1a] border-2 border-rose-600/60 shadow-2xl shadow-rose-950/80 z-50 p-4 sm:p-5 space-y-4 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                  
                  {/* Hub Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-rose-600 to-amber-600 text-white shadow-md">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                          <span>ADMIN & COMMAND CENTER</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                            HEADQUARTERS
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">เลือกฟังก์ชั่นบริหารจัดการและระบบความปลอดภัยสำหรับหัวหน้างาน</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowAdminHub(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 2x2 Bento Grid of Admin Functions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {adminNavItems.map((item) => {
                      const Icon = item.icon;
                      const isSelected = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          id={`admin-hub-item-${item.id}`}
                          onClick={() => handleSelectAdminTab(item.id)}
                          className={`p-3.5 rounded-2xl text-left transition-all border group cursor-pointer relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-gradient-to-br from-rose-950/80 via-slate-900 to-[#120e20] border-rose-500 shadow-lg shadow-rose-950/60'
                              : 'bg-slate-950/70 hover:bg-slate-900/90 border-slate-800 hover:border-rose-500/50 shadow-md'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className={`p-2 rounded-xl ${
                                item.color === 'gold' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                item.color === 'crimson' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                item.color === 'blue' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                                'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                <Icon className="w-4 h-4" />
                              </div>

                              <div className="flex items-center space-x-1.5">
                                <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                  {item.tag}
                                </span>
                                {item.badge > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-600 text-white animate-pulse">
                                    {item.badge} แจ้งเตือน
                                  </span>
                                )}
                                {isSelected && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                )}
                              </div>
                            </div>

                            <div>
                              <p className={`text-xs font-bold transition-colors ${
                                isSelected ? 'text-rose-300' : 'text-slate-100 group-hover:text-amber-300'
                              }`}>
                                {item.label}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {item.desc}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 group-hover:text-amber-400">
                            <span>คลิกเพื่อเปิดหน้าต่าง</span>
                            <span className="font-bold">&rarr;</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Hub Footer Tip */}
                  <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                      <Crown className="w-3.5 h-3.5 text-amber-400" /> สิทธิ์เข้าถึงระดับ Leader & Admin เท่านั้น
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400">&bull; Audit Trail Logging Active</span>
                  </div>

                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-500 text-xs select-none shadow-sm" title="สิทธิ์การเข้าถึงเมนูแอดมินสำหรับยศ Admin / Leader เท่านั้น">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline font-semibold">Admin:</span>
              <span className="text-slate-400 font-mono text-[11px]">สิทธิ์จำกัด (Officer)</span>
            </div>
          )}

        </div>
      </div>
    </header>
  );
};

