import React, { useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Tag, 
  Clock, 
  ShieldAlert, 
  ExternalLink, 
  Trash2, 
  CheckCheck,
  Flame,
  ShieldCheck,
  ChevronRight,
  Inbox
} from 'lucide-react';
import { AppNotification, Officer, CaseLog } from '../types';

interface NotificationsViewProps {
  currentUser: Officer | null;
  notifications: AppNotification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onOpenCaseById: (caseId: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  currentUser,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenCaseById,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const filteredNotifs = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0d1627] to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Bell className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-xs font-mono font-bold tracking-widest text-blue-400 uppercase">
                POLICE MDT NOTIFICATIONS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              การแจ้งเตือน (Notifications)
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              แจ้งเตือนเมื่อคุณถูกแท็กเป็นผู้ช่วยเหลือในคดี หรือเมื่อมีการอัปเดตสถานะคดีที่คุณเกี่ยวข้อง
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all shadow-md cursor-pointer whitespace-nowrap"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>ทำเครื่องหมายว่าอ่านทั้งหมด ({unreadCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'ALL'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          ทั้งหมด ({notifications.length})
        </button>

        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'UNREAD'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <span>ยังไม่ได้อ่าน</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-slate-950">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification Cards List */}
      {filteredNotifs.length === 0 ? (
        <div className="bg-[#0b1220] border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 text-slate-600 flex items-center justify-center mx-auto">
            <Inbox className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-white">ไม่มีการแจ้งเตือนใหม่</p>
          <p className="text-xs text-slate-400">คุณจะได้รับการแจ้งเตือนทันทีเมื่อมีตำรวจนายอื่นแท็กคุณในคดี</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifs.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (!item.read) onMarkAsRead(item.id);
                if (item.case_id) onOpenCaseById(item.case_id);
              }}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group relative flex items-start space-x-4 shadow-lg ${
                !item.read
                  ? 'bg-[#0f172a] border-blue-500/60 ring-1 ring-blue-500/30'
                  : 'bg-[#0a0f1c] hover:bg-[#0e1628] border-slate-800'
              }`}
            >
              {/* Sender Avatar or Icon */}
              <div className="relative shrink-0">
                <img
                  src={item.sender_avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                  alt={item.sender_name || 'System'}
                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-700"
                />
                {!item.read && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 ring-2 ring-slate-900 animate-pulse" />
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700">
                      {item.case_number || 'CASE'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                      {item.type === 'CASE_TAGGED' ? 'ถูกแท็กในคดี' : 'อัปเดตสถานะคดี'}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{item.created_at}</span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white leading-relaxed">
                  {item.message}
                </p>

                <div className="flex items-center space-x-3 pt-1 text-xs">
                  <span className="text-blue-400 group-hover:text-blue-300 font-bold flex items-center gap-1">
                    <span>เปิดดูรายละเอียดคดี</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
