import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';

// Load environment variables from .env in the project root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { GoogleGenAI, Type } from '@google/genai';
import { 
  Officer, 
  OfficerRole,
  CaseLog, 
  CaseType, 
  CaseStatus,
  CaseImage,
  CaseHelper,
  CaseTimelineItem,
  CaseEditRequest,
  TaggedOfficerRef,
  AppNotification,
  DutyLog, 
  BadgeSlot, 
  BadgeRequest, 
  AnomalyLog, 
  ActivityTraining, 
  PayrollPeriod, 
  PayrollRates, 
  AuditLog, 
  PayrollItem,
  ScannedOfficer,
  OfficerRank
} from './src/types';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Setup persistent uploads directory for evidence images
const UPLOADS_BASE = path.join(process.cwd(), 'uploads');
const CASES_UPLOAD_DIR = path.join(UPLOADS_BASE, 'cases');
if (!fs.existsSync(CASES_UPLOAD_DIR)) {
  fs.mkdirSync(CASES_UPLOAD_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_BASE));

// Serve public static assets (including intro videos and animations)
const PUBLIC_BASE = path.join(process.cwd(), 'public');
if (fs.existsSync(PUBLIC_BASE)) {
  app.use(express.static(PUBLIC_BASE));
  app.use('/assets', express.static(path.join(PUBLIC_BASE, 'assets')));
}
const ASSETS_BASE = path.join(process.cwd(), 'assets');
if (fs.existsSync(ASSETS_BASE)) {
  app.use('/assets', express.static(ASSETS_BASE));
}

// Multer storage for case evidence images
const caseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CASES_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase()) ? ext.toLowerCase() : '.jpg';
    const cleanName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    cb(null, cleanName);
  }
});

const uploadCaseImages = multer({
  storage: caseStorage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, JPEG, PNG, WEBP เท่านั้น'));
    }
  }
});

app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Lazy initialization of Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return geminiClient;
}

// Normalizer for officer names to detect duplicates accurately
function normalizeOfficerName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/^(pol\.|officer|chief|lt\.|commander|sergeant|capt\.|นาย|ผู้บัญชาการตำรวจ|รองผู้บัญชาการตำรวจ|สารวัตร|หมวด|จ่า|ครูฝึก|นักเรียนตำรวจ|ผบ\.|สว\.|ร\.ต\.|ด\.ต\.|ส\.ต\.|นรต\.)\s*/i, '')
    .replace(/[#\d\-_\[\]\(\)]/g, '')
    .trim();
}

// Re-sort all officers alphabetically A-Z and sequentially re-assign badge numbers #01, #02...
function sortAndRenumberOfficersAZ(): void {
  // Sort alphabetically by officer_name (A-Z)
  officers.sort((a, b) => a.officer_name.localeCompare(b.officer_name, 'th', { sensitivity: 'base' }));

  // Re-assign badges 01, 02, 03... sequentially
  officers.forEach((officer, index) => {
    const num = index + 1;
    const newBadgeNum = num < 10 ? `0${num}` : `${num}`;
    officer.badge_number = newBadgeNum;

    // Update callsign prefix nicely
    const isCommand = officer.role === 'Leader' || officer.role === 'Admin' || officer.rank === 'ผู้บัญชาการตำรวจ' || officer.rank === 'รองผู้บัญชาการตำรวจ' || officer.rank === 'สารวัตร';
    const isSwat = officer.department === 'SWAT / Special Response';
    const isTraffic = officer.department === 'Traffic Enforcement';
    const isCID = officer.department === 'Criminal Investigation (CID)';
    const prefix = isCommand ? 'COMMAND' : isSwat ? 'SIERRA' : isTraffic ? 'ECHO' : isCID ? 'KILO' : 'DELTA';
    officer.callsign = `${prefix}-${newBadgeNum}`;

    // Also update current active duty and cases if needed
    dutyLogs.forEach(d => {
      if (d.officer_discord_id === officer.discord_id) {
        d.badge_number = newBadgeNum;
      }
    });
    caseLogs.forEach(c => {
      if (c.officer_discord_id === officer.discord_id) {
        c.badge_number = newBadgeNum;
      }
    });
  });
}

// In-Memory Database Store for Around Town Police MDT (All initial records cleared)
let officers: Officer[] = [];

// Current logged in user (starts empty so login is required every time)
let currentUserId = "";

let caseLogs: CaseLog[] = [];

let notifications: AppNotification[] = [];

let caseEditRequests: CaseEditRequest[] = [];

let dutyLogs: DutyLog[] = [];

let badgeRequests: BadgeRequest[] = [];

let totalBadgeSlots = 40; // Default capacity of radio code / badge slots (can be expanded by Admin)

function getEffectiveTotalBadgeSlots(): number {
  let highestBadge = 0;
  for (const o of officers) {
    const n = parseInt(o.badge_number, 10);
    if (!isNaN(n) && n > highestBadge) {
      highestBadge = n;
    }
  }
  return Math.max(totalBadgeSlots, highestBadge, 1);
}

function formatBadgeNumber(num: number): string {
  if (num < 10) return `0${num}`;
  return `${num}`;
}

// Find the lowest available integer >= 1 not in use by any current officer
// Automatically reuses numbers from deleted users without altering existing users
function getNextAvailableBadgeNumber(): { intVal: number; formatted: string } {
  const occupiedSet = new Set<number>();
  for (const o of officers) {
    const n = parseInt(o.badge_number, 10);
    if (!isNaN(n) && n > 0) {
      occupiedSet.add(n);
    }
  }

  let candidate = 1;
  while (occupiedSet.has(candidate)) {
    candidate++;
  }

  return {
    intVal: candidate,
    formatted: formatBadgeNumber(candidate)
  };
}

// Sorts officers in ascending numerical badge order (01, 02, 03, ...) without altering their badge numbers
function sortOfficersByBadgeAsc(list: Officer[]): Officer[] {
  return list.sort((a, b) => {
    const numA = parseInt(a.badge_number, 10);
    const numB = parseInt(b.badge_number, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return (a.badge_number || '').localeCompare(b.badge_number || '');
  });
}

let caseSeqCounter = 1;
function generateNextCaseNumber(): string {
  let maxFound = 0;
  for (const c of caseLogs) {
    if (c.case_number) {
      const match = c.case_number.match(/CASE-(\d+)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxFound) maxFound = val;
      }
    }
  }
  const nextNum = Math.max(maxFound + 1, caseSeqCounter);
  caseSeqCounter = nextNum + 1;
  return `CASE-${String(nextNum).padStart(6, '0')}`;
}

let anomalyLogs: AnomalyLog[] = [];

let activities: ActivityTraining[] = [];

let payrollRates: PayrollRates = {
  rate_normal: 1000,
  rate_take2: 2500,
  rate_red: 5000,
  rate_duty_hour: 350,
  base_salary: 2500
};

let payrollCycles: PayrollPeriod[] = [];

let auditLogs: AuditLog[] = [];

// Helper to recalculate officer case aggregates
function recalculateOfficerStats(discord_id: string) {
  const officer = officers.find(o => o.discord_id === discord_id);
  if (!officer) return;

  const officerCases = caseLogs.filter(c => c.created_by === discord_id || c.officer_discord_id === discord_id);
  const normal = officerCases.filter(c => c.type === 'NORMAL' || c.case_type === 'Normal').length;
  const take2 = officerCases.filter(c => c.type === 'TAKE2' || c.case_type === 'Take2').length;
  const red = officerCases.filter(c => c.type === 'RED_CASE' || c.case_type === 'Red').length;

  officer.cases_normal = normal;
  officer.cases_take2 = take2;
  officer.cases_red = red;
  officer.total_cases = normal + take2 + red;
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// Session Store for Secure HttpOnly Cookie Authentication
interface SessionRecord {
  sessionId: string;
  discordId: string;
  createdAt: number;
  expiresAt: number;
}
const sessionStore = new Map<string, SessionRecord>();

// Helper function to safely escape HTML in server responses
function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Single Authoritative Redirect URI Resolver
// Guarantees exact match between authorization URL, Discord Developer Portal, and Token Exchange
function getEffectiveRedirectUri(req: express.Request): string {
  // 1. Highest priority: Explicit environment variable DISCORD_REDIRECT_URI
  if (process.env.DISCORD_REDIRECT_URI && process.env.DISCORD_REDIRECT_URI.trim()) {
    return process.env.DISCORD_REDIRECT_URI.trim();
  }
  
  // 2. Auto-detect from host and protocol
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  const cleanHost = host.split(',')[0].trim();
  const isHttps = (req.headers['x-forwarded-proto'] as string) === 'https' || req.secure || (!cleanHost.includes('localhost') && !cleanHost.includes('127.0.0.1'));
  const proto = isHttps ? 'https' : 'http';
  
  return `${proto}://${cleanHost}/auth/discord/callback`;
}

// Helper to render friendly error pages
function renderOAuthErrorHtml(title: string, message: string, req?: express.Request): string {
  const currentRedirectUri = req ? getEffectiveRedirectUri(req) : '';
  return `
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            background: #090d16; 
            color: #e2e8f0; 
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            min-height: 100vh; 
            margin: 0; 
            padding: 20px; 
            box-sizing: border-box; 
          }
          .box { 
            background: #131b2e; 
            border: 1px solid #e11d48; 
            padding: 32px; 
            border-radius: 20px; 
            text-align: center; 
            max-width: 480px; 
            width: 100%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.7); 
          }
          h3 { color: #f43f5e; margin: 0 0 12px 0; font-size: 18px; font-weight: bold; }
          p { color: #94a3b8; font-size: 13px; margin: 0 0 16px 0; line-height: 1.6; }
          .uri-box { background: #0c1220; border: 1px solid #334155; padding: 10px 14px; border-radius: 10px; font-family: monospace; font-size: 12px; color: #38bdf8; word-break: break-all; margin: 12px 0; text-align: left; }
          .btn { display: inline-block; background: #334155; hover:background: #475569; color: #f8fafc; padding: 10px 20px; border-radius: 12px; text-decoration: none; font-size: 13px; font-weight: bold; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="box">
          <h3>⚠️ ${escapeHtml(title)}</h3>
          <p>${escapeHtml(message)}</p>
          ${currentRedirectUri ? `<div class="uri-box"><strong>Current Redirect URI:</strong><br/>${escapeHtml(currentRedirectUri)}</div>` : ''}
          <a href="/" class="btn">กลับหน้าหลัก</a>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'DISCORD_OAUTH_ERROR', error: ${JSON.stringify(message)} }, '*');
            setTimeout(() => window.close(), 2500);
          }
        </script>
      </body>
    </html>
  `;
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// Runtime Discord OAuth Credentials (for dynamic configuration)
let runtimeDiscordClientId = process.env.DISCORD_CLIENT_ID || '';
let runtimeDiscordClientSecret = process.env.DISCORD_CLIENT_SECRET || '';
let runtimeDiscordGuildId = process.env.DISCORD_GUILD_ID || '';
let runtimeDiscordAdminIds = (process.env.DISCORD_ADMIN_IDS || process.env.ADMIN_DISCORD_IDS || '').trim();

export function getAdminDiscordIds(): string[] {
  const raw = (process.env.DISCORD_ADMIN_IDS || process.env.ADMIN_DISCORD_IDS || runtimeDiscordAdminIds || '').trim();
  if (!raw) return [];
  return raw.split(',').map(id => id.trim()).filter(Boolean);
}

export function isDiscordAdmin(discordId: string): boolean {
  if (!discordId) return false;
  const adminIds = getAdminDiscordIds();
  return adminIds.includes(discordId.trim());
}

// Get Admin Discord IDs
app.get('/api/admin/admin-ids', (req, res) => {
  const adminIds = getAdminDiscordIds();
  res.json({
    admin_ids: adminIds,
    count: adminIds.length,
    configured_in_env: Boolean((process.env.DISCORD_ADMIN_IDS || process.env.ADMIN_DISCORD_IDS || '').trim())
  });
});

// Update/Add Admin Discord IDs
app.post('/api/admin/admin-ids', (req, res) => {
  const { admin_ids, add_id, remove_id } = req.body;
  let currentIds = getAdminDiscordIds();

  if (Array.isArray(admin_ids)) {
    currentIds = admin_ids.map(id => String(id).trim()).filter(Boolean);
  } else if (add_id) {
    const cleanId = String(add_id).trim();
    if (cleanId && !currentIds.includes(cleanId)) {
      currentIds.push(cleanId);
    }
  } else if (remove_id) {
    const cleanId = String(remove_id).trim();
    currentIds = currentIds.filter(id => id !== cleanId);
  }

  runtimeDiscordAdminIds = currentIds.join(',');

  // Update officers role if they are in the admin list
  officers.forEach(o => {
    if (currentIds.includes(o.discord_id)) {
      if (o.role !== 'Leader' && o.role !== 'Admin') {
        o.role = 'Leader';
        if (o.rank === 'นักเรียนตำรวจ' || !o.rank) o.rank = 'ผู้บัญชาการตำรวจ';
        if (o.department === 'Patrol Division' || !o.department) o.department = 'High Command';
      }
    }
  });

  res.json({ success: true, admin_ids: currentIds, message: "บันทึกรายชื่อ Discord ID ผู้ดูแลเรียบร้อยแล้ว" });
});

// Helper to synchronize all officers status with dutyLogs
function syncOfficerDutyStatuses() {
  officers.forEach(o => {
    const hasActiveDuty = dutyLogs.some(d => d.officer_discord_id === o.discord_id && d.is_active);
    if (hasActiveDuty) {
      if (o.status !== 'In Action') {
        o.status = 'On Duty';
      }
    } else {
      o.status = 'Off Duty';
    }
  });
}

// Strict helper to check if an officer is actively ON_DUTY
export function isOfficerOnDuty(officer: Officer | null | undefined): boolean {
  if (!officer) return false;
  const hasActiveDuty = dutyLogs.some(d => d.officer_discord_id === officer.discord_id && d.is_active);
  return hasActiveDuty && officer.status !== 'Off Duty';
}

// Auth & Current User Session Verification
app.get('/api/auth/me', (req, res) => {
  syncOfficerDutyStatuses();
  const sessionCookie = req.cookies?.atpd_session;
  let activeUser: Officer | null = null;

  if (sessionCookie && sessionStore.has(sessionCookie)) {
    const sess = sessionStore.get(sessionCookie)!;
    if (sess.expiresAt > Date.now()) {
      activeUser = officers.find(o => o.discord_id === sess.discordId) || null;
    } else {
      sessionStore.delete(sessionCookie);
    }
  }

  // Backward-compatible fallback for development switch if session cookie is absent
  if (!activeUser && currentUserId) {
    activeUser = officers.find(o => o.discord_id === currentUserId) || null;
  }

  res.json({
    authenticated: !!activeUser,
    user: activeUser,
    available_users: officers.map(o => ({
      discord_id: o.discord_id,
      officer_name: o.officer_name,
      badge_number: o.badge_number,
      rank: o.rank,
      role: o.role,
      department: o.department,
      avatar: o.avatar,
      status: o.status
    }))
  });
});

// Logout and clear HttpOnly Session Cookie
app.post('/api/auth/logout', (req, res) => {
  const sessionCookie = req.cookies?.atpd_session;
  if (sessionCookie && sessionStore.has(sessionCookie)) {
    sessionStore.delete(sessionCookie);
  }
  res.clearCookie('atpd_session', { path: '/' });
  currentUserId = "";
  res.json({ success: true, message: "ออกจากระบบเรียบร้อยแล้ว" });
});

// Direct Login (Internal/Testing fallback)
app.post('/api/auth/login', (req, res) => {
  const { discord_id } = req.body;
  const user = officers.find(o => o.discord_id === discord_id);
  if (user) {
    currentUserId = discord_id;
    user.last_active = "Just now";

    // Issue session cookie
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(32).toString('hex');
    const isHttps = (req.headers['x-forwarded-proto'] as string) === 'https' || req.secure;
    sessionStore.set(sessionId, {
      sessionId,
      discordId: user.discord_id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    });
    res.cookie('atpd_session', sessionId, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({ success: true, user, message: `เข้าสู่ระบบในชื่อ ${user.officer_name} สำเร็จ` });
  } else {
    res.status(404).json({ error: "ไม่พบบัญชีเจ้าหน้าที่ที่ผูกกับ Discord ID นี้ในระบบ" });
  }
});

// Dedicated Sandbox/Test Login endpoint to access Dashboard for testing
app.post('/api/auth/test-sandbox-login', (req, res) => {
  const { 
    role = 'Leader', 
    officer_name, 
    discord_id,
    rank,
    department
  } = req.body;

  const testRole: OfficerRole = role === 'Leader' || role === 'Admin' ? role : 'Member';
  const testDiscordId = discord_id ? String(discord_id).trim() : (testRole === 'Leader' ? 'test_admin_999' : 'test_officer_101');
  const testName = officer_name ? String(officer_name).trim() : (testRole === 'Leader' ? 'ผู้บัญชาการ (Test Admin)' : 'ส.ต.ต. สมชาย ทดสอบ (Test Officer)');
  const testRank = rank || (testRole === 'Leader' ? 'ผู้บัญชาการตำรวจ' : 'เจ้าหน้าที่สายตรวจ');
  const testDept = department || (testRole === 'Leader' ? 'High Command' : 'Patrol Division');
  const testBadge = testRole === 'Leader' ? '01' : String(officers.length + 1).padStart(2, '0');

  let existingOfficer = officers.find(o => o.discord_id === testDiscordId);

  if (!existingOfficer) {
    existingOfficer = {
      discord_id: testDiscordId,
      discord_username: `test_${testRole.toLowerCase()}`,
      discord_global_name: testName,
      officer_name: testName,
      callsign: testRole === 'Leader' ? 'COMMAND-01' : `UNIT-${testBadge}`,
      avatar: testRole === 'Leader' 
        ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      badge_number: testBadge,
      rank: testRank,
      role: testRole,
      duty_hours: 12,
      total_cases: 8,
      cases_normal: 5,
      cases_take2: 2,
      cases_red: 1,
      citations_count: 3,
      status: "Off Duty",
      department: testDept,
      join_date: new Date().toISOString().split('T')[0],
      last_active: "Just now",
      phone_number: "555-0101"
    };
    officers.unshift(existingOfficer);

    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      admin_discord_id: testDiscordId,
      admin_name: testName,
      action_type: "OFFICER_UPDATE",
      action_details: `สร้างบัญชีทดสอบเพื่อเข้าสู่ระบบ MDT (${testName} [${testRole}])`,
      target_user: testName,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
    });
  } else {
    existingOfficer.last_active = "Just now";
    // Check if there is an active duty log, otherwise remain Off Duty
    const hasActiveDuty = dutyLogs.some(d => d.officer_discord_id === existingOfficer!.discord_id && d.is_active);
    existingOfficer.status = hasActiveDuty ? "On Duty" : "Off Duty";
  }

  currentUserId = existingOfficer.discord_id;

  // Issue session cookie
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(32).toString('hex');
  const isHttps = (req.headers['x-forwarded-proto'] as string) === 'https' || req.secure;
  sessionStore.set(sessionId, {
    sessionId,
    discordId: existingOfficer.discord_id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
  res.cookie('atpd_session', sessionId, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });

  res.json({
    success: true,
    user: existingOfficer,
    message: `เข้าสู่ Dashboard ทดสอบในฐานะ ${existingOfficer.officer_name} (${existingOfficer.role}) สำเร็จ`
  });
});

// Switch User (Admin/Testing helper)
app.post('/api/auth/switch', (req, res) => {
  const { discord_id } = req.body;
  const user = officers.find(o => o.discord_id === discord_id);
  if (user) {
    currentUserId = discord_id;
    user.last_active = "Just now";

    // Issue new session cookie
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(32).toString('hex');
    const isHttps = (req.headers['x-forwarded-proto'] as string) === 'https' || req.secure;
    sessionStore.set(sessionId, {
      sessionId,
      discordId: user.discord_id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    });
    res.cookie('atpd_session', sessionId, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({ success: true, user });
  } else {
    res.status(404).json({ error: "Officer not found" });
  }
});

// Discord OAuth2 Config Info (No secret is ever exposed)
app.get('/api/auth/discord/config', (req, res) => {
  const effectiveClientId = (process.env.DISCORD_CLIENT_ID || runtimeDiscordClientId || '').trim();
  const effectiveClientSecret = (process.env.DISCORD_CLIENT_SECRET || runtimeDiscordClientSecret || '').trim();
  const isConfigured = !!(effectiveClientId && effectiveClientSecret);
  const callbackUrl = getEffectiveRedirectUri(req);

  res.json({
    isConfigured,
    clientId: effectiveClientId ? `${effectiveClientId.slice(0, 5)}...${effectiveClientId.slice(-4)}` : null,
    fullClientId: effectiveClientId || null,
    hasSecret: !!effectiveClientSecret,
    callbackUrl,
    suggestedDevCallback: 'https://ais-dev-adkr7s52ohgtcv5hwffyk7-712108442204.asia-southeast1.run.app/auth/discord/callback',
    suggestedProdCallback: 'https://ais-pre-adkr7s52ohgtcv5hwffyk7-712108442204.asia-southeast1.run.app/auth/discord/callback'
  });
});

// Update Discord OAuth credentials at runtime
app.post('/api/auth/discord/config', (req, res) => {
  const { client_id, client_secret, guild_id } = req.body;
  if (client_id !== undefined) runtimeDiscordClientId = client_id.trim();
  if (client_secret !== undefined) runtimeDiscordClientSecret = client_secret.trim();
  if (guild_id !== undefined) runtimeDiscordGuildId = guild_id.trim();

  const isConfigured = !!(
    (process.env.DISCORD_CLIENT_ID || runtimeDiscordClientId) &&
    (process.env.DISCORD_CLIENT_SECRET || runtimeDiscordClientSecret)
  );

  res.json({
    success: true,
    isConfigured,
    message: isConfigured ? 'บันทึกการตั้งค่า Discord OAuth สำเร็จ' : 'บันทึกการตั้งค่าแล้ว (โปรดระบุทั้ง Client ID และ Secret)'
  });
});

// Helper endpoint to get current OAuth URL
app.get('/api/auth/discord/url', (req, res) => {
  const clientId = (process.env.DISCORD_CLIENT_ID || runtimeDiscordClientId || '').trim();
  const clientSecret = (process.env.DISCORD_CLIENT_SECRET || runtimeDiscordClientSecret || '').trim();
  const redirectUri = getEffectiveRedirectUri(req);

  if (!clientId || !clientSecret) {
    return res.json({
      configured: false,
      url: null,
      redirectUri,
      message: 'ยังไม่ได้ระบุ DISCORD_CLIENT_ID และ DISCORD_CLIENT_SECRET'
    });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const isHttps = (req.headers['x-forwarded-proto'] as string) === 'https' || req.secure;
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/'
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    prompt: 'consent',
    state
  });

  const authUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;

  res.json({
    configured: true,
    url: authUrl,
    redirectUri
  });
});

// -------------------------------------------------------------
// DISCORD OAUTH2 ROUTES
// -------------------------------------------------------------

// 1. GET /auth/discord - Direct Authorization Entry Point
app.get('/auth/discord', (req, res) => {
  const clientId = (process.env.DISCORD_CLIENT_ID || runtimeDiscordClientId || '').trim();
  const clientSecret = (process.env.DISCORD_CLIENT_SECRET || runtimeDiscordClientSecret || '').trim();
  const redirectUri = getEffectiveRedirectUri(req);
  const isHttps = (req.headers['x-forwarded-proto'] as string) === 'https' || req.secure || (!redirectUri.includes('localhost') && !redirectUri.includes('127.0.0.1'));

  if (!clientId || !clientSecret) {
    const missingVars: string[] = [];
    if (!clientId) missingVars.push('DISCORD_CLIENT_ID');
    if (!clientSecret) missingVars.push('DISCORD_CLIENT_SECRET');
    console.error(`[Discord OAuth Error] Missing environment variable(s) on server: ${missingVars.join(', ')}`);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charset="utf-8" />
          <title>Discord OAuth Not Configured</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              background: #090d16; 
              color: #e2e8f0; 
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0; 
              padding: 20px; 
              box-sizing: border-box; 
            }
            .card { 
              background: #131b2e; 
              border: 1px solid #334155; 
              border-radius: 24px; 
              padding: 36px; 
              max-width: 520px; 
              width: 100%; 
              text-align: center;
              box-shadow: 0 20px 40px rgba(0,0,0,0.6); 
            }
            h2 { color: #f43f5e; margin-top: 0; font-size: 20px; display: flex; align-items: center; justify-content: center; gap: 10px; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 16px 0 24px 0; }
            .uri-box { background: #0c1220; border: 1px solid #1e293b; padding: 10px 14px; border-radius: 10px; font-family: monospace; font-size: 12px; color: #38bdf8; word-break: break-all; margin: 12px 0; text-align: left; }
            .btn { display: inline-block; background: #334155; hover:background: #475569; color: #f8fafc; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⚠️ Discord OAuth is not configured on the server.</h2>
            <p>ยังไม่ได้กำหนดค่า <code>${escapeHtml(missingVars.join(', '))}</code> ใน Environment Variables (.env) ของระบบ</p>
            <div class="uri-box">
              <strong>Callback URL:</strong><br/>
              ${escapeHtml(redirectUri)}
            </div>
            <a href="/" class="btn">กลับหน้า Login</a>
          </div>
        </body>
      </html>
    `);
  }

  // Generate cryptographic state to prevent CSRF / State Attacks
  const state = crypto.randomBytes(20).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/'
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    prompt: 'consent',
    state
  });

  const authUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
  res.redirect(authUrl);
});

// 2. GET /auth/discord/callback - OAuth2 Callback Handler
const handleDiscordCallback = async (req: express.Request, res: express.Response) => {
  const { code, error, error_description, state } = req.query;
  const clientId = (process.env.DISCORD_CLIENT_ID || runtimeDiscordClientId || '').trim();
  const clientSecret = (process.env.DISCORD_CLIENT_SECRET || runtimeDiscordClientSecret || '').trim();
  const redirectUri = getEffectiveRedirectUri(req);
  const isHttps = (req.headers['x-forwarded-proto'] as string) === 'https' || req.secure || (!redirectUri.includes('localhost') && !redirectUri.includes('127.0.0.1'));

  // User cancelled or Discord authorization error
  if (error) {
    const errorMsg = (error_description as string) || (error as string) || 'Discord authorization failed';
    return res.status(400).send(renderOAuthErrorHtml('Discord authorization failed', errorMsg, req));
  }

  if (!code) {
    return res.status(400).send(renderOAuthErrorHtml('Discord authorization failed', 'Missing authorization code', req));
  }

  // State verification to prevent CSRF
  const storedState = req.cookies?.oauth_state;
  if (!state || (storedState && state !== storedState)) {
    return res.status(400).send(renderOAuthErrorHtml('Invalid OAuth state', 'OAuth state verification failed. Please try again.', req));
  }

  if (!clientId || !clientSecret) {
    return res.status(500).send(renderOAuthErrorHtml('Discord OAuth configuration missing', 'Client credentials missing on server.', req));
  }

  try {
    // Exchange authorization code for access token on backend
    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Discord token exchange failed:', tokenData.error || tokenData);
      const errMsg = tokenData.error_description || tokenData.error || 'Token exchange failed';
      return res.status(400).send(renderOAuthErrorHtml('Discord token exchange failed', errMsg, req));
    }

    // Fetch Discord User Profile using the access token
    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const discordUser = await userRes.json();

    if (!userRes.ok || !discordUser.id) {
      return res.status(400).send(renderOAuthErrorHtml('Unable to fetch Discord user', 'Failed to retrieve Discord profile with token.', req));
    }

    // Construct Discord Avatar URL
    let avatarUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
    if (discordUser.avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`;
    }

    const discordUsername = discordUser.username || '';
    const discordGlobalName = discordUser.global_name || discordUser.username || '';
    const displayName = discordGlobalName || discordUsername || `Officer_${discordUser.id.slice(-4)}`;

    // Find or Create Officer in Database
    let officer = officers.find(o => o.discord_id === discordUser.id);
    let isNewOfficer = false;

    if (!officer) {
      // Check existing officer by name match if migrating
      officer = officers.find(o => o.officer_name.toLowerCase() === displayName.toLowerCase());
      if (officer) {
        officer.discord_id = discordUser.id;
        officer.discord_username = discordUsername;
        officer.discord_global_name = discordGlobalName;
        officer.avatar = avatarUrl;
        officer.last_active = "Just now";
      }
    }

    const isAdminUser = isDiscordAdmin(discordUser.id);

    if (!officer) {
      isNewOfficer = true;
      const nextAvailable = getNextAvailableBadgeNumber();
      const newBadge = nextAvailable.formatted;
      officer = {
        discord_id: discordUser.id,
        discord_username: discordUsername,
        discord_global_name: discordGlobalName,
        officer_name: displayName,
        callsign: isAdminUser ? `COMMAND-${newBadge}` : `UNIT-${newBadge}`,
        avatar: avatarUrl,
        badge_number: newBadge,
        rank: isAdminUser ? "ผู้บัญชาการตำรวจ" : "นักเรียนตำรวจ",
        role: isAdminUser ? "Leader" : "Member",
        duty_hours: 0,
        total_cases: 0,
        cases_normal: 0,
        cases_take2: 0,
        cases_red: 0,
        citations_count: 0,
        status: "Off Duty",
        department: isAdminUser ? "High Command" : "Patrol Division",
        join_date: new Date().toISOString().split('T')[0],
        last_active: "Just now",
        phone_number: "555-0199"
      };
      officers.push(officer);
      sortOfficersByBadgeAsc(officers);

      auditLogs.unshift({
        id: `AUDIT-${Date.now()}`,
        admin_discord_id: discordUser.id,
        admin_name: officer.officer_name,
        action_type: "OFFICER_UPDATE",
        action_details: `เข้าสู่ระบบและลงทะเบียนครั้งแรกผ่าน Discord OAuth (${officer.officer_name} #${newBadge}${isAdminUser ? ' [High Command]' : ''}) [จัดสรรเลขว่างที่น้อยที่สุด]`,
        target_user: officer.officer_name,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
      });
    } else {
      officer.discord_username = discordUsername;
      officer.discord_global_name = discordGlobalName;
      officer.avatar = avatarUrl;
      officer.last_active = "Just now";
      if (isAdminUser && officer.role !== 'Leader' && officer.role !== 'Admin') {
        officer.role = 'Leader';
        if (officer.department === 'Patrol Division' || !officer.department) officer.department = 'High Command';
        if (officer.rank === 'นักเรียนตำรวจ' || !officer.rank) officer.rank = 'ผู้บัญชาการตำรวจ';
      }
    }

    currentUserId = officer.discord_id;

    // Issue Secure Session
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(32).toString('hex');
    sessionStore.set(sessionId, {
      sessionId,
      discordId: officer.discord_id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    res.cookie('atpd_session', sessionId, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.clearCookie('oauth_state', { path: '/' });

    // Send Success HTML: automatically handles both popup mode and direct browser redirect
    res.send(`
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charset="utf-8">
          <title>Discord Login Success</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              background-color: #060913; 
              color: #f1f5f9; 
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .card {
              background: linear-gradient(135deg, rgba(88, 101, 242, 0.15), #0c1220 70%);
              border: 1px solid rgba(88, 101, 242, 0.4);
              padding: 28px;
              border-radius: 20px;
              text-align: center;
              max-width: 420px;
              box-shadow: 0 10px 35px -5px rgba(0, 0, 0, 0.7);
            }
            .avatar {
              width: 72px;
              height: 72px;
              border-radius: 18px;
              border: 2px solid #5865F2;
              margin-bottom: 12px;
              object-fit: cover;
            }
            h2 { margin: 0 0 6px 0; color: #fff; font-size: 18px; }
            p { margin: 0; color: #94a3b8; font-size: 13px; }
            .badge {
              display: inline-block;
              padding: 4px 12px;
              background: rgba(88, 101, 242, 0.25);
              color: #c7d2fe;
              border-radius: 20px;
              font-size: 11px;
              font-weight: bold;
              margin-top: 12px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <img class="avatar" src="${officer.avatar}" alt="${escapeHtml(officer.officer_name)}" />
            <h2>ยืนยันตัวตน Discord สำเร็จ!</h2>
            <p>ยินดีต้อนรับ ${escapeHtml(officer.officer_name)} (#${officer.badge_number})</p>
            <div class="badge">กำลังเข้าสู่ระบบ Around Town MDT...</div>
          </div>
          <script>
            const officerData = ${JSON.stringify(officer)};
            try {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ 
                  type: 'DISCORD_OAUTH_SUCCESS', 
                  user: officerData, 
                  isNew: ${isNewOfficer} 
                }, '*');
                setTimeout(() => window.close(), 300);
              } else {
                window.location.href = '/';
              }
            } catch (e) {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error("Discord OAuth Error:", err);
    res.status(500).send(renderOAuthErrorHtml('Discord authorization failed', err.message || 'Unknown server error', req));
  }
};

app.get('/auth/discord/callback', handleDiscordCallback);
app.get('/auth/discord/callback/', handleDiscordCallback);

// Officers
app.get('/api/officers', (req, res) => {
  syncOfficerDutyStatuses();
  sortOfficersByBadgeAsc(officers);
  res.json({ officers });
});

// Endpoint to query lowest available badge number for UI preview
app.get('/api/officers/next-badge', (req, res) => {
  const next = getNextAvailableBadgeNumber();
  res.json({
    success: true,
    next_badge_number: next.formatted,
    next_badge_int: next.intVal,
    message: "ระบบค้นหาเลขว่างที่น้อยที่สุดให้อัตโนมัติ"
  });
});

app.post('/api/officers', (req, res) => {
  let assignedBadge = req.body.badge_number ? String(req.body.badge_number).trim() : '';

  // If badge is empty or requested as auto, assign the lowest positive integer available
  if (!assignedBadge || assignedBadge === 'auto') {
    assignedBadge = getNextAvailableBadgeNumber().formatted;
  } else {
    // Standardize badge formatting (e.g. 3 -> "03")
    const parsedInt = parseInt(assignedBadge, 10);
    if (!isNaN(parsedInt) && parsedInt > 0) {
      assignedBadge = formatBadgeNumber(parsedInt);
    }
  }

  // Check if badge is already occupied by another officer
  const existingBadge = officers.find(o => {
    const oInt = parseInt(o.badge_number, 10);
    const aInt = parseInt(assignedBadge, 10);
    return (!isNaN(oInt) && !isNaN(aInt) && oInt === aInt) || o.badge_number === assignedBadge;
  });

  if (existingBadge) {
    const nextVacant = getNextAvailableBadgeNumber().formatted;
    return res.status(400).json({ 
      error: `หมายเลขประจำตัว #${assignedBadge} ถูกใช้งานแล้วโดย ${existingBadge.officer_name} (ระบบแนะนำเลขว่างที่น้อยที่สุด: #${nextVacant})` 
    });
  }

  const role = req.body.role || "Member";
  const rank = req.body.rank || "นักเรียนตำรวจ";
  const dept = req.body.department || "Patrol Division";
  const isCommand = role === 'Leader' || role === 'Admin' || rank === 'ผู้บัญชาการตำรวจ' || rank === 'รองผู้บัญชาการตำรวจ' || rank === 'สารวัตร';
  const prefix = isCommand ? 'COMMAND' : dept === 'SWAT / Special Response' ? 'SIERRA' : dept === 'Traffic Enforcement' ? 'ECHO' : dept === 'Criminal Investigation (CID)' ? 'KILO' : 'DELTA';

  const newOfficer: Officer = {
    discord_id: req.body.discord_id || `${Date.now()}`,
    officer_name: req.body.officer_name,
    callsign: req.body.callsign || `${prefix}-${assignedBadge}`,
    avatar: req.body.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    badge_number: assignedBadge,
    rank: rank,
    role: role,
    duty_hours: Number(req.body.duty_hours) || 0,
    total_cases: 0,
    cases_normal: 0,
    cases_take2: 0,
    cases_red: 0,
    citations_count: 0,
    status: "Off Duty",
    department: dept,
    join_date: new Date().toISOString().split('T')[0],
    last_active: "Just now",
    phone_number: req.body.phone_number || "555-0199"
  };

  // Add officer and maintain ascending numerical badge order
  officers.push(newOfficer);
  sortOfficersByBadgeAsc(officers);

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: currentUserId,
    admin_name: officers.find(o => o.discord_id === currentUserId)?.officer_name || "Admin",
    action_type: "OFFICER_UPDATE",
    action_details: `เพิ่มข้อมูลเจ้าหน้าที่ใหม่: ${newOfficer.officer_name} (Badge: #${newOfficer.badge_number}, Rank: ${newOfficer.rank})`,
    target_user: newOfficer.officer_name,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
  });

  res.json({ success: true, officer: newOfficer, officers });
});

app.put('/api/officers/:id', (req, res) => {
  const { id } = req.params;
  const index = officers.findIndex(o => o.discord_id === id);
  if (index === -1) return res.status(404).json({ error: "Officer not found" });

  officers[index] = { ...officers[index], ...req.body };

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: currentUserId,
    admin_name: officers.find(o => o.discord_id === currentUserId)?.officer_name || "Admin",
    action_type: "OFFICER_UPDATE",
    action_details: `แก้ไขข้อมูลเจ้าหน้าที่: ${officers[index].officer_name}`,
    target_user: officers[index].officer_name,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
  });

  res.json({ success: true, officer: officers[index] });
});

app.delete('/api/officers/:id', (req, res) => {
  const { id } = req.params;
  const index = officers.findIndex(o => o.discord_id === id);
  if (index === -1) return res.status(404).json({ error: "Officer not found" });

  const removedOfficer = officers[index];
  officers.splice(index, 1);

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: currentUserId,
    admin_name: officers.find(o => o.discord_id === currentUserId)?.officer_name || "Admin",
    action_type: "OFFICER_UPDATE",
    action_details: `ปลดประจำการ / ลบข้อมูลเจ้าหน้าที่: ${removedOfficer.officer_name} (Badge: #${removedOfficer.badge_number})`,
    target_user: removedOfficer.officer_name,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
  });

  res.json({ success: true, message: `ลบข้อมูลเจ้าหน้าที่ ${removedOfficer.officer_name} เรียบร้อยแล้ว`, officers });
});

// Helper to resolve current officer from session or fallback
function getAuthenticatedOfficer(req: express.Request): Officer | null {
  const sessionId = req.cookies?.atpd_session;
  if (sessionId) {
    const session = sessionStore.get(sessionId);
    if (session && session.expiresAt > Date.now()) {
      const off = officers.find(o => o.discord_id === session.discordId);
      if (off) return off;
    }
  }
  if (currentUserId) {
    const off = officers.find(o => o.discord_id === currentUserId);
    if (off) return off;
  }
  return officers[0] || null;
}

// -------------------------------------------------------------
// CASES ENDPOINTS
// -------------------------------------------------------------

// 1. GET /api/cases - List all cases
app.get('/api/cases', (req, res) => {
  res.json({ cases: caseLogs });
});

// 2. GET /api/cases/:id - Get single case by ID or case_number
app.get('/api/cases/:id', (req, res) => {
  const { id } = req.params;
  const found = caseLogs.find(c => c.id === id || c.case_number === id);
  if (!found) {
    return res.status(404).json({ error: "ไม่พบคดีดังกล่าวในระบบ" });
  }
  res.json({ success: true, case: found });
});

// 3. POST /api/cases - Create new case with validation, images, and helpers
app.post('/api/cases', uploadCaseImages.array('images', 10), (req, res) => {
  try {
    const authOfficer = getAuthenticatedOfficer(req);
    if (!authOfficer) {
      return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อนลงเคส" });
    }

    // Strict Duty Check: Officer MUST be ON_DUTY to create cases
    if (!isOfficerOnDuty(authOfficer)) {
      return res.status(403).json({ 
        error: "ต้องเข้าเวรปฏิบัติหน้าที่ (ON_DUTY) ก่อนจึงจะสามารถลงบันทึกคดีได้", 
        code: "DUTY_REQUIRED" 
      });
    }

    const { 
      type, 
      title, 
      description, 
      incident_date, 
      incident_time, 
      location, 
      helpers: rawHelpers, 
      notes 
    } = req.body;

    // Validate type strictly
    const rawType = (type || '').toString().trim().toUpperCase();
    let validatedType: 'NORMAL' | 'TAKE2' | 'RED_CASE';
    if (rawType === 'NORMAL' || rawType === 'เคสปกติ' || rawType === 'ลงเคสปกติ') {
      validatedType = 'NORMAL';
    } else if (rawType === 'TAKE2' || rawType === 'TAKE 2') {
      validatedType = 'TAKE2';
    } else if (rawType === 'RED_CASE' || rawType === 'RED' || rawType === 'คดีแดง') {
      validatedType = 'RED_CASE';
    } else {
      return res.status(400).json({ error: "ประเภทเคสไม่ถูกต้อง (ต้องเป็น NORMAL, TAKE2 หรือ RED_CASE เท่านั้น)" });
    }

    // Process title and description (optional with smart defaults)
    const thaiTypeName = validatedType === 'NORMAL' ? 'ลงเคสปกติ' : validatedType === 'TAKE2' ? 'เคสพิเศษ (Take2)' : 'คดีแดง';
    const finalTitle = (title && typeof title === 'string' && title.trim().length > 0)
      ? title.trim()
      : `ลงบันทึกคดี (${thaiTypeName}) - ${authOfficer.officer_name}`;
    
    const finalDescription = (description && typeof description === 'string' && description.trim().length > 0)
      ? description.trim()
      : `บันทึกภาพหลักฐานและระบุผู้ร่วมปฏิบัติงาน (${thaiTypeName})`;

    // Validate images: MUST have at least 1 image
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "ต้องแนบรูปหลักฐานอย่างน้อย 1 รูปก่อนส่งเคส" });
    }

    const caseId = `CASE-${Date.now()}`;
    const autoCaseNumber = generateNextCaseNumber(); // e.g. "CASE-000001"
    const nowIso = new Date().toISOString();
    const formattedTimestamp = nowIso.replace('T', ' ').slice(0, 16);

    const nowFormattedDate = incident_date ? String(incident_date).trim() : nowIso.split('T')[0];
    const nowFormattedTime = incident_time ? String(incident_time).trim() : nowIso.split('T')[1].slice(0, 5);

    // Process uploaded images
    const caseImages: CaseImage[] = files.map((file, idx) => ({
      id: `IMG-${Date.now()}-${idx}-${crypto.randomBytes(3).toString('hex')}`,
      case_id: caseId,
      url: `/uploads/cases/${file.filename}`,
      storage_key: file.filename,
      filename: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
      created_at: formattedTimestamp
    }));

    // Process helpers / tagged officers
    let parsedHelpers: any[] = [];
    if (rawHelpers) {
      try {
        parsedHelpers = typeof rawHelpers === 'string' ? JSON.parse(rawHelpers) : rawHelpers;
      } catch (e) {
        parsedHelpers = [];
      }
    }

    const caseHelpers: CaseHelper[] = [];
    const validHelperOfficers: Officer[] = [];

    if (Array.isArray(parsedHelpers)) {
      for (const item of parsedHelpers) {
        const discordId = item.user_id || item.discord_id || item.id;
        const matchedOfficer = officers.find(o => o.discord_id === discordId || o.officer_name === item.officer_name);
        if (matchedOfficer && matchedOfficer.discord_id !== authOfficer.discord_id) {
          // Strict Duty Check: Cannot tag helpers who are OFF_DUTY
          if (!isOfficerOnDuty(matchedOfficer)) {
            return res.status(400).json({
              error: `ไม่สามารถแท็กเจ้าหน้าที่ที่อยู่นอกเวรได้ (${matchedOfficer.officer_name} เป็น OFF_DUTY)`,
              code: "HELPER_OFF_DUTY"
            });
          }
          // Avoid duplicates
          if (!caseHelpers.some(h => h.user_id === matchedOfficer.discord_id)) {
            caseHelpers.push({
              id: `HLP-${Date.now()}-${caseHelpers.length}`,
              case_id: caseId,
              user_id: matchedOfficer.discord_id,
              officer_name: matchedOfficer.officer_name,
              badge_number: matchedOfficer.badge_number,
              avatar: matchedOfficer.avatar,
              rank: matchedOfficer.rank,
              created_at: formattedTimestamp
            });
            validHelperOfficers.push(matchedOfficer);
          }
        }
      }
    }

    const timeline: CaseTimelineItem[] = [
      {
        id: `TL-${Date.now()}-1`,
        timestamp: formattedTimestamp,
        officer_name: authOfficer.officer_name,
        action: `สร้าง Case ${autoCaseNumber}`,
        details: `บันทึกคดีประเภท ${thaiTypeName}`
      }
    ];

    if (caseHelpers.length > 0) {
      timeline.push({
        id: `TL-${Date.now()}-2`,
        timestamp: formattedTimestamp,
        officer_name: authOfficer.officer_name,
        action: `แท็กผู้ช่วยเหลือ`,
        details: `แท็ก ${caseHelpers.map(h => `@${h.officer_name} (#${h.badge_number})`).join(', ')}`
      });
    }

    const newCase: CaseLog = {
      id: caseId,
      case_number: autoCaseNumber,
      type: validatedType,
      title: finalTitle,
      description: finalDescription,
      incident_date: nowFormattedDate,
      incident_time: nowFormattedTime,
      location: (location || 'Los Santos').trim(),
      created_by: authOfficer.discord_id,
      created_by_name: authOfficer.officer_name,
      created_by_badge: authOfficer.badge_number,
      created_by_avatar: authOfficer.avatar,
      created_by_rank: authOfficer.rank,
      status: 'OPEN',
      images: caseImages,
      helpers: caseHelpers,
      notes: (notes || '').trim(),
      timeline,
      created_at: formattedTimestamp,
      updated_at: formattedTimestamp,

      // Compatibility fields
      officer_discord_id: authOfficer.discord_id,
      officer_name: authOfficer.officer_name,
      badge_number: authOfficer.badge_number,
      case_type: validatedType === 'NORMAL' ? 'Normal' : validatedType === 'TAKE2' ? 'Take2' : 'Red',
      suspect_name: finalTitle,
      charges: [thaiTypeName],
      fine_amount: validatedType === 'RED_CASE' ? 50000 : validatedType === 'TAKE2' ? 25000 : 10000,
      jail_time: validatedType === 'RED_CASE' ? 60 : validatedType === 'TAKE2' ? 30 : 15,
      timestamp: formattedTimestamp
    };

    caseLogs.unshift(newCase);
    recalculateOfficerStats(authOfficer.discord_id);

    // Create notifications for each tagged helper
    validHelperOfficers.forEach(helperOfficer => {
      const notif: AppNotification = {
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        user_id: helperOfficer.discord_id,
        case_id: newCase.id,
        case_number: newCase.case_number,
        case_type: newCase.type,
        type: 'CASE_TAGGED',
        message: `คุณถูกแท็กใน Case ${newCase.case_number} (ประเภท: ${thaiTypeName}, ผู้ลงเคส: ${authOfficer.officer_name})`,
        sender_id: authOfficer.discord_id,
        sender_name: authOfficer.officer_name,
        sender_avatar: authOfficer.avatar,
        read: false,
        created_at: formattedTimestamp
      };
      notifications.unshift(notif);
    });

    // Create Audit Log
    auditLogs.unshift({
      id: `AUDIT-${Date.now()}`,
      admin_discord_id: authOfficer.discord_id,
      admin_name: authOfficer.officer_name,
      action_type: 'OFFICER_UPDATE',
      action_details: `ลงเคสใหม่ [${newCase.case_number}] ประเภท: ${thaiTypeName} - หัวข้อ: ${newCase.title} (แนบรูป: ${caseImages.length} รูป, ผู้ช่วยเหลือ: ${caseHelpers.length} นาย)`,
      target_user: authOfficer.officer_name,
      timestamp: formattedTimestamp
    });

    res.json({ success: true, case: newCase, message: `ลงเคส ${newCase.case_number} เรียบร้อยแล้ว` });
  } catch (err: any) {
    console.error('[Create Case Error]', err);
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการสร้างเคส' });
  }
});

// 4. PATCH /api/cases/:id/status - Update case status
app.patch('/api/cases/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;
  const authOfficer = getAuthenticatedOfficer(req);

  if (!authOfficer) {
    return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" });
  }

  // Check if officer is allowed to update status (Must be ON_DUTY or Leader/Admin)
  const isCommand = authOfficer.role === 'Leader' || authOfficer.role === 'Admin';
  if (!isCommand && !isOfficerOnDuty(authOfficer)) {
    return res.status(403).json({ 
      error: "ต้องเข้าเวรปฏิบัติหน้าที่ (ON_DUTY) ก่อนจึงจะสามารถแก้ไขสถานะคดีได้", 
      code: "DUTY_REQUIRED" 
    });
  }

  const foundCase = caseLogs.find(c => c.id === id || c.case_number === id);
  if (!foundCase) {
    return res.status(404).json({ error: "ไม่พบคดีดังกล่าว" });
  }

  const validStatuses: CaseStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "สถานะไม่ถูกต้อง (OPEN, IN_PROGRESS, RESOLVED, CLOSED)" });
  }

  const oldStatus = foundCase.status;
  foundCase.status = status;
  foundCase.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 16);

  if (!foundCase.timeline) foundCase.timeline = [];
  foundCase.timeline.push({
    id: `TL-${Date.now()}`,
    timestamp: foundCase.updated_at,
    officer_name: authOfficer?.officer_name || 'System',
    action: `เปลี่ยนสถานะจาก ${oldStatus} เป็น ${status}`,
    details: note || undefined
  });

  // Notify creator if someone else changed the status
  if (authOfficer && authOfficer.discord_id !== foundCase.created_by) {
    notifications.unshift({
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: foundCase.created_by,
      case_id: foundCase.id,
      case_number: foundCase.case_number,
      case_type: foundCase.type,
      type: 'CASE_STATUS_CHANGED',
      message: `สถานะของ Case ${foundCase.case_number} ถูกเปลี่ยนเป็น ${status} โดย ${authOfficer.officer_name}`,
      sender_id: authOfficer.discord_id,
      sender_name: authOfficer.officer_name,
      sender_avatar: authOfficer.avatar,
      read: false,
      created_at: foundCase.updated_at
    });
  }

  res.json({ success: true, case: foundCase, message: `อัปเดตสถานะคดีเป็น ${status} เรียบร้อย` });
});

// 5. DELETE /api/cases/:id - Delete a case (Admin / Leader or case creator)
app.delete('/api/cases/:id', (req, res) => {
  const { id } = req.params;
  const authOfficer = getAuthenticatedOfficer(req);
  
  const index = caseLogs.findIndex(c => c.id === id || c.case_number === id);
  if (index === -1) {
    return res.status(404).json({ error: "ไม่พบคดีที่ต้องการลบในระบบ" });
  }

  const caseToDelete = caseLogs[index];

  // Authorization check: Admin, Leader, configured admin ID, or case creator
  const isAdmin = authOfficer?.role === 'Admin' || authOfficer?.role === 'Leader' || (authOfficer && getAdminDiscordIds().includes(authOfficer.discord_id));
  const isCreator = authOfficer && (authOfficer.discord_id === caseToDelete.created_by || authOfficer.discord_id === caseToDelete.officer_discord_id);

  if (!isAdmin && !isCreator) {
    return res.status(403).json({ error: "คุณไม่มีสิทธิ์ในการลบคดีนี้ (เฉพาะผู้ดูแลระบบหรือผู้ลงคดีเท่านั้น)" });
  }

  // Remove case
  caseLogs.splice(index, 1);

  // Recalculate officer statistics
  if (caseToDelete.created_by) {
    recalculateOfficerStats(caseToDelete.created_by);
  }
  if (caseToDelete.officer_discord_id && caseToDelete.officer_discord_id !== caseToDelete.created_by) {
    recalculateOfficerStats(caseToDelete.officer_discord_id);
  }

  // Record Audit Trail
  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: authOfficer?.discord_id || currentUserId,
    admin_name: authOfficer?.officer_name || "Admin",
    action_type: "OFFICER_UPDATE",
    action_details: `ลบข้อมูลคดี [${caseToDelete.case_number || caseToDelete.id}] - ${caseToDelete.title} (ผู้ลงคดีเดิม: ${caseToDelete.created_by_name || caseToDelete.officer_name})`,
    target_user: caseToDelete.created_by_name || caseToDelete.officer_name,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
  });

  res.json({
    success: true,
    message: `ลบคดี ${caseToDelete.case_number || caseToDelete.id} ออกจากระบบเรียบร้อยแล้ว`,
    cases: caseLogs
  });
});

// -------------------------------------------------------------
// NOTIFICATIONS ENDPOINTS
// -------------------------------------------------------------

app.get('/api/notifications', (req, res) => {
  const authOfficer = getAuthenticatedOfficer(req);
  if (!authOfficer) {
    return res.json({ notifications: [], unread_count: 0 });
  }

  const userNotifs = notifications.filter(n => n.user_id === authOfficer.discord_id);
  const unread_count = userNotifs.filter(n => !n.read).length;

  res.json({
    success: true,
    notifications: userNotifs,
    unread_count
  });
});

app.post('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const authOfficer = getAuthenticatedOfficer(req);
  if (!authOfficer) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const notif = notifications.find(n => n.id === id && n.user_id === authOfficer.discord_id);
  if (notif) {
    notif.read = true;
  }

  res.json({ success: true });
});

app.post('/api/notifications/read-all', (req, res) => {
  const authOfficer = getAuthenticatedOfficer(req);
  if (!authOfficer) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  notifications.forEach(n => {
    if (n.user_id === authOfficer.discord_id) {
      n.read = true;
    }
  });

  res.json({ success: true });
});

// -------------------------------------------------------------
// CASE EDIT REQUESTS ENDPOINTS
// -------------------------------------------------------------

// 1. GET /api/case-edit-requests - List all case edit requests
app.get('/api/case-edit-requests', (req, res) => {
  const authOfficer = getAuthenticatedOfficer(req);
  const isAdmin = authOfficer && (authOfficer.role === 'Admin' || authOfficer.role === 'Leader' || isDiscordAdmin(authOfficer.discord_id));

  // If officer is admin, show all requests. If not, show requests created by officer or where officer is mentioned/involved
  if (isAdmin) {
    return res.json({ success: true, requests: caseEditRequests });
  }

  if (authOfficer) {
    const visible = caseEditRequests.filter(r => 
      r.requester_discord_id === authOfficer.discord_id ||
      r.mentioned_officers.some(m => m.discord_id === authOfficer.discord_id)
    );
    return res.json({ success: true, requests: visible });
  }

  res.json({ success: true, requests: caseEditRequests });
});

// 2. POST /api/case-edit-requests - Create a new case edit request
// STRICT RULES:
// 1. Requester must be the original case creator
// 2. Requester must be actively ON_DUTY
// 3. All mentioned/tagged officers must be actively ON_DUTY in real database
app.post('/api/case-edit-requests', (req, res) => {
  try {
    syncOfficerDutyStatuses();
    const authOfficer = getAuthenticatedOfficer(req);
    if (!authOfficer) {
      return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อนส่งคำร้องขอแก้ไขคดี" });
    }

    const {
      case_id,
      caseId,
      requested_title,
      requestedTitle,
      requestedTag,
      requested_type,
      requestedType,
      requested_fine,
      requested_description,
      requestedDescription,
      reason,
      mentioned_user_ids,
      mentionedUserIds,
      mentioned_officers,
      mentionedOfficers
    } = req.body;

    const targetCaseId = case_id || caseId;
    if (!targetCaseId) {
      return res.status(400).json({ error: "กรุณาระบุรหัสคดี (case_id)" });
    }

    const foundCase = caseLogs.find(c => c.id === targetCaseId || c.case_number === targetCaseId);
    if (!foundCase) {
      return res.status(404).json({ error: "ไม่พบคดีดังกล่าวในระบบ" });
    }

    // RULE 1: Must be the original case creator
    const isCreator =
      (foundCase.created_by && foundCase.created_by === authOfficer.discord_id) ||
      (foundCase.officer_discord_id && foundCase.officer_discord_id === authOfficer.discord_id);

    if (!isCreator) {
      return res.status(403).json({
        error: "เฉพาะเจ้าหน้าที่ผู้สร้าง/ลงคดีนี้เท่านั้นที่มีสิทธิ์ส่งคำร้องขอแก้ไข",
        code: "NOT_CASE_CREATOR"
      });
    }

    // RULE 2: Requester MUST be actively ON_DUTY
    if (!isOfficerOnDuty(authOfficer)) {
      return res.status(403).json({
        error: "ต้องเข้าเวรปฏิบัติหน้าที่ (ON_DUTY) จึงจะสามารถส่งคำร้องขอแก้ไขคดีได้",
        code: "DUTY_REQUIRED"
      });
    }

    // Validate reason
    const cleanReason = (reason || '').toString().trim();
    if (!cleanReason) {
      return res.status(400).json({ error: "กรุณาระบุเหตุผลในการขอแก้ไขคดี" });
    }

    // Extract raw mentioned user IDs
    let rawMentionedIds: string[] = [];
    if (Array.isArray(mentioned_user_ids)) rawMentionedIds.push(...mentioned_user_ids);
    if (Array.isArray(mentionedUserIds)) rawMentionedIds.push(...mentionedUserIds);
    if (Array.isArray(mentioned_officers)) {
      mentioned_officers.forEach((m: any) => {
        const id = m.discord_id || m.user_id || m.id;
        if (id) rawMentionedIds.push(id);
      });
    }
    if (Array.isArray(mentionedOfficers)) {
      mentionedOfficers.forEach((m: any) => {
        const id = m.discord_id || m.user_id || m.id;
        if (id) rawMentionedIds.push(id);
      });
    }

    // Deduplicate mentioned IDs and exclude self
    const uniqueMentionedIds = Array.from(new Set(rawMentionedIds.map(id => String(id).trim()).filter(Boolean)))
      .filter(id => id !== authOfficer.discord_id);

    // RULE 3: Backend Verification of Mentioned Officers from real Database
    const validatedMentionedOfficers: TaggedOfficerRef[] = [];

    for (const tid of uniqueMentionedIds) {
      // Find officer in real database
      const targetOfficer = officers.find(o => o.discord_id === tid || o.officer_name.toLowerCase() === tid.toLowerCase());
      if (!targetOfficer) {
        return res.status(400).json({
          error: `ไม่พบข้อมูลเจ้าหน้าที่ (ID: ${tid}) ในฐานข้อมูลระบบ`,
          code: "OFFICER_NOT_FOUND"
        });
      }

      // STRICT CHECK: Is targetOfficer ON_DUTY in real database?
      if (!isOfficerOnDuty(targetOfficer)) {
        return res.status(403).json({
          error: `ไม่สามารถแท็ก ${targetOfficer.officer_name} ได้ เนื่องจากขณะนี้ ${targetOfficer.officer_name} ออกเวรแล้ว`,
          code: "OFFICER_OFF_DUTY"
        });
      }

      validatedMentionedOfficers.push({
        discord_id: targetOfficer.discord_id,
        officer_name: targetOfficer.officer_name,
        badge_number: targetOfficer.badge_number,
        avatar: targetOfficer.avatar,
        rank: targetOfficer.rank
      });
    }

    // Determine requested values
    const newReqTitle = (requested_title || requestedTitle || requestedTag || '').toString().trim() || foundCase.title;
    let newReqType: 'NORMAL' | 'TAKE2' | 'RED_CASE' = foundCase.type;
    const rawType = (requested_type || requestedType || '').toString().trim().toUpperCase();
    if (rawType === 'NORMAL' || rawType === 'เคสปกติ') newReqType = 'NORMAL';
    else if (rawType === 'TAKE2' || rawType === 'TAKE 2') newReqType = 'TAKE2';
    else if (rawType === 'RED_CASE' || rawType === 'RED' || rawType === 'คดีแดง') newReqType = 'RED_CASE';

    const newReqDesc = (requested_description || requestedDescription !== undefined) 
      ? String(requested_description || requestedDescription).trim()
      : foundCase.description;

    const fineAmount = typeof requested_fine === 'number' 
      ? requested_fine 
      : newReqType === 'RED_CASE' ? 50000 : newReqType === 'TAKE2' ? 25000 : 10000;

    const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const newEditRequest: CaseEditRequest = {
      id: `EDITREQ-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      case_id: foundCase.id,
      case_number: foundCase.case_number,
      original_title: foundCase.title,
      original_type: foundCase.type,
      original_fine: foundCase.fine_amount,
      original_description: foundCase.description,
      requested_title: newReqTitle,
      requested_type: newReqType,
      requested_fine: fineAmount,
      requested_description: newReqDesc,
      reason: cleanReason,
      requester_discord_id: authOfficer.discord_id,
      requester_name: authOfficer.officer_name,
      requester_badge: authOfficer.badge_number,
      requester_avatar: authOfficer.avatar,
      requester_rank: authOfficer.rank,
      mentioned_officers: validatedMentionedOfficers,
      status: 'PENDING',
      created_at: nowFormatted
    };

    caseEditRequests.unshift(newEditRequest);

    // Update case timeline
    if (!foundCase.timeline) foundCase.timeline = [];
    const helperNames = validatedMentionedOfficers.map(m => `@${m.officer_name} (#${m.badge_number})`).join(', ');
    foundCase.timeline.push({
      id: `TL-${Date.now()}`,
      timestamp: nowFormatted,
      officer_name: authOfficer.officer_name,
      action: `ยื่นคำร้องขอแก้ไขคดี [${foundCase.case_number}]`,
      details: `ขอเปลี่ยนเป็น "${newReqTitle}" (เหตุผล: ${cleanReason})${helperNames ? ` [จนท.ที่เกี่ยวข้อง: ${helperNames}]` : ''}`
    });

    // Notify Admins & Leaders
    const admins = officers.filter(o => o.role === 'Leader' || o.role === 'Admin' || isDiscordAdmin(o.discord_id));
    admins.forEach(adm => {
      if (adm.discord_id !== authOfficer.discord_id) {
        notifications.unshift({
          id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          user_id: adm.discord_id,
          case_id: foundCase.id,
          case_number: foundCase.case_number,
          case_type: foundCase.type,
          type: 'CASE_EDIT_REQUESTED',
          message: `คำร้องขอแก้ไขคดี [${foundCase.case_number}] จาก ${authOfficer.officer_name} (รอการพิจารณา)`,
          sender_id: authOfficer.discord_id,
          sender_name: authOfficer.officer_name,
          sender_avatar: authOfficer.avatar,
          read: false,
          created_at: nowFormatted
        });
      }
    });

    // Notify Tagged Officers
    validatedMentionedOfficers.forEach(m => {
      notifications.unshift({
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        user_id: m.discord_id,
        case_id: foundCase.id,
        case_number: foundCase.case_number,
        case_type: foundCase.type,
        type: 'CASE_TAGGED',
        message: `คุณถูกระบุเป็นเจ้าหน้าที่ที่เกี่ยวข้องในคำร้องขอแก้ไขคดี [${foundCase.case_number}] โดย ${authOfficer.officer_name}`,
        sender_id: authOfficer.discord_id,
        sender_name: authOfficer.officer_name,
        sender_avatar: authOfficer.avatar,
        read: false,
        created_at: nowFormatted
      });
    });

    // Create Audit Log
    auditLogs.unshift({
      id: `AUDIT-${Date.now()}`,
      admin_discord_id: authOfficer.discord_id,
      admin_name: authOfficer.officer_name,
      action_type: 'OFFICER_UPDATE',
      action_details: `ยื่นคำร้องขอแก้ไขคดี [${foundCase.case_number}] ขอเปลี่ยนเป็น "${newReqTitle}" (เหตุผล: ${cleanReason})${helperNames ? ` [แท็กจนท.: ${helperNames}]` : ''}`,
      target_user: authOfficer.officer_name,
      timestamp: nowFormatted
    });

    res.json({
      success: true,
      request: newEditRequest,
      message: `ยื่นคำร้องขอแก้ไขคดี ${foundCase.case_number} เรียบร้อยแล้ว (รอผู้ดูแลระบบพิจารณา)`
    });
  } catch (err: any) {
    console.error('[Case Edit Request Error]', err);
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการสร้างคำร้อง' });
  }
});

// 3. POST /api/case-edit-requests/:id/approve - Admin Approve Edit Request
app.post('/api/case-edit-requests/:id/approve', (req, res) => {
  const { id } = req.params;
  const authOfficer = getAuthenticatedOfficer(req);
  if (!authOfficer) {
    return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" });
  }

  const isAdmin = authOfficer.role === 'Admin' || authOfficer.role === 'Leader' || isDiscordAdmin(authOfficer.discord_id);
  if (!isAdmin) {
    return res.status(403).json({ error: "เฉพาะผู้ดูแลระบบ (Admin / Leader) เท่านั้นที่มีสิทธิ์อนุมัติคำร้อง" });
  }

  const reqItem = caseEditRequests.find(r => r.id === id);
  if (!reqItem) {
    return res.status(404).json({ error: "ไม่พบคำร้องขอแก้ไขดังกล่าวในระบบ" });
  }

  if (reqItem.status !== 'PENDING') {
    return res.status(400).json({ error: `คำร้องนี้ได้รับการดำเนินการไปแล้ว (สถานะ: ${reqItem.status})` });
  }

  const foundCase = caseLogs.find(c => c.id === reqItem.case_id || c.case_number === reqItem.case_number);
  if (!foundCase) {
    return res.status(404).json({ error: "ไม่พบคดีต้นฉบับในระบบ" });
  }

  const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const oldTitle = foundCase.title;
  const oldType = foundCase.type;

  // 1. Update the actual Case
  foundCase.title = reqItem.requested_title;
  foundCase.suspect_name = reqItem.requested_title;
  foundCase.type = reqItem.requested_type;
  foundCase.case_type = reqItem.requested_type === 'RED_CASE' ? 'Red' : reqItem.requested_type === 'TAKE2' ? 'Take2' : 'Normal';
  if (reqItem.requested_description) {
    foundCase.description = reqItem.requested_description;
  }
  if (reqItem.requested_fine) {
    foundCase.fine_amount = reqItem.requested_fine;
  }
  foundCase.jail_time = reqItem.requested_type === 'RED_CASE' ? 60 : reqItem.requested_type === 'TAKE2' ? 30 : 15;
  foundCase.updated_at = nowFormatted;

  if (!foundCase.timeline) foundCase.timeline = [];
  foundCase.timeline.push({
    id: `TL-${Date.now()}`,
    timestamp: nowFormatted,
    officer_name: authOfficer.officer_name,
    action: `อนุมัติการแก้ไขคดี [${foundCase.case_number}]`,
    details: `เปลี่ยนชื่อคดีจาก "${oldTitle}" เป็น "${foundCase.title}" (อนุมัติโดย: ${authOfficer.officer_name})`
  });

  if (foundCase.created_by) {
    recalculateOfficerStats(foundCase.created_by);
  }

  // 2. Update Request Status to APPROVED
  reqItem.status = 'APPROVED';
  reqItem.reviewed_by = authOfficer.discord_id;
  reqItem.reviewed_by_name = authOfficer.officer_name;
  reqItem.reviewed_at = nowFormatted;

  // 3. Create Audit Log
  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: authOfficer.discord_id,
    admin_name: authOfficer.officer_name,
    action_type: 'OFFICER_UPDATE',
    action_details: `[อนุมัติคำร้องขอแก้ไข] คดี [${foundCase.case_number}] เปลี่ยนชื่อเป็น "${foundCase.title}" (ประเภท: ${foundCase.type}) ของ ${reqItem.requester_name}`,
    target_user: reqItem.requester_name,
    timestamp: nowFormatted
  });

  // 4. Notify Requester
  notifications.unshift({
    id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: reqItem.requester_discord_id,
    case_id: foundCase.id,
    case_number: foundCase.case_number,
    case_type: foundCase.type,
    type: 'CASE_EDIT_APPROVED',
    message: `คำร้องขอแก้ไขคดี [${foundCase.case_number}] ของคุณได้รับการอนุมัติแล้ว โดย ${authOfficer.officer_name}`,
    sender_id: authOfficer.discord_id,
    sender_name: authOfficer.officer_name,
    sender_avatar: authOfficer.avatar,
    read: false,
    created_at: nowFormatted
  });

  // 5. Notify Tagged Officers
  reqItem.mentioned_officers.forEach(m => {
    notifications.unshift({
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: m.discord_id,
      case_id: foundCase.id,
      case_number: foundCase.case_number,
      case_type: foundCase.type,
      type: 'CASE_EDIT_APPROVED',
      message: `คำร้องขอแก้ไขคดี [${foundCase.case_number}] ที่คุณมีส่วนเกี่ยวข้องได้รับการอนุมัติแล้ว โดย ${authOfficer.officer_name}`,
      sender_id: authOfficer.discord_id,
      sender_name: authOfficer.officer_name,
      sender_avatar: authOfficer.avatar,
      read: false,
      created_at: nowFormatted
    });
  });

  res.json({
    success: true,
    message: `อนุมัติคำร้องขอแก้ไขคดี ${foundCase.case_number} เรียบร้อยแล้ว`,
    request: reqItem,
    case: foundCase
  });
});

// 4. POST /api/case-edit-requests/:id/reject - Admin Reject Edit Request
app.post('/api/case-edit-requests/:id/reject', (req, res) => {
  const { id } = req.params;
  const { reason, rejection_reason } = req.body;
  const authOfficer = getAuthenticatedOfficer(req);
  if (!authOfficer) {
    return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" });
  }

  const isAdmin = authOfficer.role === 'Admin' || authOfficer.role === 'Leader' || isDiscordAdmin(authOfficer.discord_id);
  if (!isAdmin) {
    return res.status(403).json({ error: "เฉพาะผู้ดูแลระบบ (Admin / Leader) เท่านั้นที่มีสิทธิ์ปฏิเสธคำร้อง" });
  }

  const cleanRejectionReason = (rejection_reason || reason || '').toString().trim();
  if (!cleanRejectionReason) {
    return res.status(400).json({ error: "กรุณาระบุเหตุผลในการปฏิเสธคำร้องขอแก้ไข" });
  }

  const reqItem = caseEditRequests.find(r => r.id === id);
  if (!reqItem) {
    return res.status(404).json({ error: "ไม่พบคำร้องขอแก้ไขดังกล่าวในระบบ" });
  }

  if (reqItem.status !== 'PENDING') {
    return res.status(400).json({ error: `คำร้องนี้ได้รับการดำเนินการไปแล้ว (สถานะ: ${reqItem.status})` });
  }

  const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 16);

  // 1. Request status becomes REJECTED, Case remains UNTOUCHED
  reqItem.status = 'REJECTED';
  reqItem.rejection_reason = cleanRejectionReason;
  reqItem.reviewed_by = authOfficer.discord_id;
  reqItem.reviewed_by_name = authOfficer.officer_name;
  reqItem.reviewed_at = nowFormatted;

  // 2. Add Timeline Entry to Case
  const foundCase = caseLogs.find(c => c.id === reqItem.case_id || c.case_number === reqItem.case_number);
  if (foundCase) {
    if (!foundCase.timeline) foundCase.timeline = [];
    foundCase.timeline.push({
      id: `TL-${Date.now()}`,
      timestamp: nowFormatted,
      officer_name: authOfficer.officer_name,
      action: `ปฏิเสธคำร้องขอแก้ไขคดี [${foundCase.case_number}]`,
      details: `เหตุผล: ${cleanRejectionReason} (โดย: ${authOfficer.officer_name})`
    });
  }

  // 3. Create Audit Log
  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: authOfficer.discord_id,
    admin_name: authOfficer.officer_name,
    action_type: 'OFFICER_UPDATE',
    action_details: `[ปฏิเสธคำร้องขอแก้ไข] คดี [${reqItem.case_number}] ของ ${reqItem.requester_name} (เหตุผล: ${cleanRejectionReason})`,
    target_user: reqItem.requester_name,
    timestamp: nowFormatted
  });

  // 4. Notify Requester
  notifications.unshift({
    id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: reqItem.requester_discord_id,
    case_id: reqItem.case_id,
    case_number: reqItem.case_number,
    case_type: reqItem.original_type,
    type: 'CASE_EDIT_REJECTED',
    message: `คำร้องขอแก้ไขคดี [${reqItem.case_number}] ของคุณถูกปฏิเสธ: ${cleanRejectionReason}`,
    sender_id: authOfficer.discord_id,
    sender_name: authOfficer.officer_name,
    sender_avatar: authOfficer.avatar,
    read: false,
    created_at: nowFormatted
  });

  res.json({
    success: true,
    message: `ปฏิเสธคำร้องขอแก้ไขคดี ${reqItem.case_number} เรียบร้อยแล้ว`,
    request: reqItem
  });
});

// 5. DELETE /api/case-edit-requests/:id - Delete or Cancel Request
app.delete('/api/case-edit-requests/:id', (req, res) => {
  const { id } = req.params;
  const authOfficer = getAuthenticatedOfficer(req);
  if (!authOfficer) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const index = caseEditRequests.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "ไม่พบคำร้องขอแก้ไขดังกล่าว" });
  }

  const reqItem = caseEditRequests[index];
  const isAdmin = authOfficer.role === 'Admin' || authOfficer.role === 'Leader' || isDiscordAdmin(authOfficer.discord_id);
  const isOwner = reqItem.requester_discord_id === authOfficer.discord_id;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: "คุณไม่มีสิทธิ์ในการลบคำร้องนี้" });
  }

  caseEditRequests.splice(index, 1);
  res.json({ success: true, message: "ลบคำร้องขอแก้ไขเรียบร้อยแล้ว" });
});

// Duty Clock In / Out Toggle
app.get('/api/duty/logs', (req, res) => {
  res.json({ dutyLogs });
});

app.post('/api/duty/clock-toggle', (req, res) => {
  const { officer_discord_id, notes, force_clock_out } = req.body;
  const officer = officers.find(o => o.discord_id === (officer_discord_id || currentUserId));
  if (!officer) return res.status(404).json({ error: "Officer not found" });

  const activeDuty = dutyLogs.find(d => d.officer_discord_id === officer.discord_id && d.is_active);

  if (activeDuty) {
    // Check if officer has active unresolved cases (OPEN / IN_PROGRESS)
    const activeCases = caseLogs.filter(c => 
      (c.created_by === officer.discord_id || c.officer_discord_id === officer.discord_id) && 
      (c.status === 'OPEN' || c.status === 'IN_PROGRESS')
    );

    if (activeCases.length > 0 && !force_clock_out) {
      return res.status(409).json({
        success: false,
        require_confirmation: true,
         activeCasesCount: activeCases.length,
         activeCases: activeCases.map(c => ({
          id: c.id,
          case_number: c.case_number,
          title: c.title,
          status: c.status
        })),
        message: `คุณมีคดีที่กำลังดำเนินการอยู่ ${activeCases.length} คดี หากออกเวรคดีเหล่านี้จะยังค้างอยู่ในระบบ โปรดยืนยันการออกเวร`
      });
    }

    // Clock OUT
    const now = new Date();
    const nowTimestamp = now.getTime();
    const nowFormatted = now.toISOString().replace('T', ' ').slice(0, 19);
    const nowISO = now.toISOString();

    let startMs = activeDuty.clock_in_timestamp;
    if (!startMs && activeDuty.clock_in_iso) {
      startMs = new Date(activeDuty.clock_in_iso).getTime();
    }
    if (!startMs && activeDuty.clock_in) {
      startMs = new Date(activeDuty.clock_in.replace(' ', 'T')).getTime();
      if (isNaN(startMs)) {
        startMs = new Date(activeDuty.clock_in).getTime();
      }
    }
    if (!startMs || isNaN(startMs)) {
      startMs = nowTimestamp;
    }

    const elapsedMs = Math.max(0, nowTimestamp - startMs);
    const durationSec = Math.floor(elapsedMs / 1000);
    const durationMin = parseFloat((elapsedMs / (1000 * 60)).toFixed(2));
    const durationHours = parseFloat((elapsedMs / (1000 * 60 * 60)).toFixed(2));

    activeDuty.is_active = false;
    activeDuty.clock_out = nowFormatted;
    activeDuty.clock_out_iso = nowISO;
    activeDuty.clock_out_timestamp = nowTimestamp;
    activeDuty.duration_minutes = durationMin;
    activeDuty.duration_seconds = durationSec;

    officer.status = 'Off Duty';
    officer.duty_hours = parseFloat(((Number(officer.duty_hours) || 0) + durationHours).toFixed(2));
    officer.last_active = nowFormatted;

    // Formatting elapsed text for audit log
    const hrs = Math.floor(durationSec / 3600);
    const mins = Math.floor((durationSec % 3600) / 60);
    const secs = durationSec % 60;
    const timeDetailStr = hrs > 0 
      ? `${hrs} ชม. ${mins} นาที ${secs} วิ (${durationHours} ชม.)`
      : mins > 0 
        ? `${mins} นาที ${secs} วิ (${durationHours} ชม.)`
        : `${secs} วินาที (${durationHours} ชม.)`;

    auditLogs.unshift({
      id: `AUDIT-${Date.now()}`,
      admin_discord_id: currentUserId,
      admin_name: officers.find(o => o.discord_id === currentUserId)?.officer_name || "System",
      action_type: "DUTY_OVERRIDE",
      action_details: `${officer.officer_name} (#${officer.badge_number}) ลงชื่อออกเวร (Clock-Out) ปฏิบัติหน้าที่จริง: ${timeDetailStr}`,
      target_user: officer.officer_name,
      timestamp: nowFormatted
    });

    res.json({ 
      success: true, 
      action: "CLOCK_OUT", 
      duty: activeDuty, 
      officer,
      timeDetailStr,
      durationSec,
      durationMin,
      durationHours
    });
  } else {
    // Clock IN
    const now = new Date();
    const nowTimestamp = now.getTime();
    const nowFormatted = now.toISOString().replace('T', ' ').slice(0, 19);
    const nowISO = now.toISOString();

    const newDuty: DutyLog = {
      id: `DUTY-${Date.now().toString().slice(-6)}`,
      officer_discord_id: officer.discord_id,
      officer_name: officer.officer_name,
      badge_number: officer.badge_number,
      clock_in: nowFormatted,
      clock_in_iso: nowISO,
      clock_in_timestamp: nowTimestamp,
      duration_minutes: 0,
      duration_seconds: 0,
      is_active: true,
      notes: notes || "เข้าเวรปฏิบัติหน้าที่ตามปกติ"
    };

    dutyLogs.unshift(newDuty);
    officer.status = 'On Duty';
    officer.last_active = nowFormatted;

    auditLogs.unshift({
      id: `AUDIT-${Date.now()}`,
      admin_discord_id: currentUserId,
      admin_name: officers.find(o => o.discord_id === currentUserId)?.officer_name || "System",
      action_type: "DUTY_OVERRIDE",
      action_details: `${officer.officer_name} (#${officer.badge_number}) ลงชื่อเข้าเวร (Clock-In) เวลา ${nowFormatted}`,
      target_user: officer.officer_name,
      timestamp: nowFormatted
    });

    res.json({ success: true, action: "CLOCK_IN", duty: newDuty, officer });
  }
});

// Badges Management (Dynamic Slots: 01 to totalBadgeSlots+)
app.get('/api/badges', (req, res) => {
  const slots: BadgeSlot[] = [];
  const maxSlots = getEffectiveTotalBadgeSlots();
  
  for (let i = 1; i <= maxSlots; i++) {
    const numStr = formatBadgeNumber(i);
    const assigned = officers.find(o => o.badge_number === numStr);
    const pendingReq = badgeRequests.find(r => r.requested_badge === numStr && r.status === 'Pending');

    if (assigned) {
      slots.push({
        badge_number: numStr,
        status: 'Busy',
        assigned_officer: {
          discord_id: assigned.discord_id,
          officer_name: assigned.officer_name,
          rank: assigned.rank,
          avatar: assigned.avatar
        }
      });
    } else if (pendingReq) {
      slots.push({
        badge_number: numStr,
        status: 'Pending',
        pending_request: {
          id: pendingReq.id,
          officer_name: pendingReq.officer_name,
          current_badge: pendingReq.current_badge
        }
      });
    } else {
      slots.push({
        badge_number: numStr,
        status: 'Available'
      });
    }
  }

  res.json({ 
    slots, 
    requests: badgeRequests,
    totalSlots: maxSlots,
    baseSlots: totalBadgeSlots
  });
});

// Admin Expand / Add Radio Code Slots
app.post('/api/badges/expand-slots', (req, res) => {
  const admin = officers.find(o => o.discord_id === currentUserId);
  if (!admin || (admin.role !== 'Leader' && admin.role !== 'Admin')) {
    return res.status(403).json({ error: "เฉพาะระดับ Leader หรือ Admin เท่านั้นที่มีสิทธิ์เพิ่มจำนวนเลขวิทยุ" });
  }

  const { additional_slots, total_slots } = req.body;
  const oldTotal = getEffectiveTotalBadgeSlots();
  let newCalculatedTotal = oldTotal;

  if (typeof additional_slots === 'number' && additional_slots > 0) {
    totalBadgeSlots = Math.max(totalBadgeSlots, oldTotal) + Math.floor(additional_slots);
    newCalculatedTotal = totalBadgeSlots;
  } else if (typeof total_slots === 'number' && total_slots > 0) {
    totalBadgeSlots = Math.floor(total_slots);
    newCalculatedTotal = totalBadgeSlots;
  } else {
    return res.status(400).json({ error: "กรุณาระบุจำนวนเลขที่ต้องการเพิ่ม (additional_slots หรือ total_slots)" });
  }

  const effectiveTotal = getEffectiveTotalBadgeSlots();
  const addedCount = effectiveTotal - oldTotal;

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: admin.discord_id,
    admin_name: admin.officer_name,
    action_type: "BADGE_APPROVAL",
    action_details: `[เพิ่มเลขวิทยุ] เพิ่มความจุหมายเลขวิทยุจาก ${oldTotal} เป็น ${effectiveTotal} หมายเลข (${addedCount >= 0 ? `+${addedCount}` : addedCount} หมายเลข)`,
    target_user: `Police MDT System (${effectiveTotal} Slots)`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
  });

  res.json({ 
    success: true, 
    message: `เพิ่มจำนวนเลขวิทยุสำเร็จ รวมเป็น ${effectiveTotal} หมายเลข (#01 - #${formatBadgeNumber(effectiveTotal)})`,
    totalSlots: effectiveTotal,
    baseSlots: totalBadgeSlots,
    addedCount
  });
});

// Badge Request Submission
app.post('/api/badges/request', (req, res) => {
  const { officer_discord_id, requested_badge, reason } = req.body;
  const officer = officers.find(o => o.discord_id === (officer_discord_id || currentUserId));
  if (!officer) return res.status(404).json({ error: "Officer not found" });

  // Format badge
  const numInt = parseInt(requested_badge, 10);
  const maxSlots = getEffectiveTotalBadgeSlots();
  if (isNaN(numInt) || numInt < 1 || numInt > Math.max(maxSlots, 999)) {
    return res.status(400).json({ error: `กรุณาระบุหมายเลขประจำตัวระหว่าง 01 ถึง ${formatBadgeNumber(Math.max(maxSlots, 999))}` });
  }
  const formattedBadge = formatBadgeNumber(numInt);

  // Check if requested badge is in use
  const inUse = officers.find(o => o.badge_number === formattedBadge);
  if (inUse) {
    return res.status(400).json({ error: `หมายเลข ${formattedBadge} มีผู้ใช้งานอยู่แล้ว (${inUse.officer_name})` });
  }

  // Check if existing pending request exists for this badge
  const existingPending = badgeRequests.find(r => r.requested_badge === formattedBadge && r.status === 'Pending');
  if (existingPending) {
    return res.status(400).json({ error: `หมายเลข ${formattedBadge} กำลังมีคำขอรอการพิจารณาอยู่โดย ${existingPending.officer_name}` });
  }

  const newReq: BadgeRequest = {
    id: `REQ-${Date.now().toString().slice(-4)}`,
    officer_discord_id: officer.discord_id,
    officer_name: officer.officer_name,
    officer_avatar: officer.avatar,
    officer_rank: officer.rank,
    current_badge: officer.badge_number,
    requested_badge: formattedBadge,
    reason: reason || "ยื่นขอเปลี่ยนรหัสประจำตัววิทยุ",
    status: 'Pending',
    requested_at: new Date().toISOString().replace('T', ' ').slice(0, 16)
  };

  badgeRequests.unshift(newReq);

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: currentUserId,
    admin_name: officer.officer_name,
    action_type: "BADGE_APPROVAL",
    action_details: `ยื่นคำขอเปลี่ยนเลขประจำตัวจาก ${officer.badge_number} เป็น ${formattedBadge}`,
    target_user: officer.officer_name,
    timestamp: newReq.requested_at
  });

  res.json({ success: true, request: newReq });
});

// Leader Badge Approval
app.post('/api/badges/approve', (req, res) => {
  const { request_id, review_notes } = req.body;
  const request = badgeRequests.find(r => r.id === request_id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  const admin = officers.find(o => o.discord_id === currentUserId);
  if (!admin || (admin.role !== 'Leader' && admin.role !== 'Admin')) {
    return res.status(403).json({ error: "เฉพาะระดับ Leader หรือ Admin เท่านั้นที่มีสิทธิ์อนุมัติ" });
  }

  const targetOfficer = officers.find(o => o.discord_id === request.officer_discord_id);
  if (!targetOfficer) return res.status(404).json({ error: "Target officer not found" });

  const oldBadge = targetOfficer.badge_number;
  targetOfficer.badge_number = request.requested_badge;
  targetOfficer.callsign = targetOfficer.callsign.replace(oldBadge, request.requested_badge);

  request.status = 'Approved';
  request.reviewed_at = new Date().toISOString().replace('T', ' ').slice(0, 16);
  request.reviewed_by = `${admin.officer_name} (${admin.rank})`;
  request.review_notes = review_notes || "อนุมัติคำขอเปลี่ยนหมายเลขประจำตัว";

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: admin.discord_id,
    admin_name: admin.officer_name,
    action_type: "BADGE_APPROVAL",
    action_details: `[อนุมัติ] เปลี่ยนเลขประจำตัวของ ${targetOfficer.officer_name} จาก ${oldBadge} เป็น ${request.requested_badge}`,
    target_user: targetOfficer.officer_name,
    timestamp: request.reviewed_at
  });

  res.json({ success: true, request, officer: targetOfficer });
});

// Leader Badge Rejection
app.post('/api/badges/reject', (req, res) => {
  const { request_id, review_notes } = req.body;
  const request = badgeRequests.find(r => r.id === request_id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  const admin = officers.find(o => o.discord_id === currentUserId);
  if (!admin || (admin.role !== 'Leader' && admin.role !== 'Admin')) {
    return res.status(403).json({ error: "เฉพาะระดับ Leader หรือ Admin เท่านั้นที่มีสิทธิ์ปฏิเสธ" });
  }

  request.status = 'Rejected';
  request.reviewed_at = new Date().toISOString().replace('T', ' ').slice(0, 16);
  request.reviewed_by = `${admin.officer_name} (${admin.rank})`;
  request.review_notes = review_notes || "ไม่อนุมัติคำขอเปลี่ยนหมายเลข";

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: admin.discord_id,
    admin_name: admin.officer_name,
    action_type: "BADGE_REJECTION",
    action_details: `[ปฏิเสธ] คำขอเปลี่ยนเลขประจำตัวของ ${request.officer_name} (ขอเลข ${request.requested_badge}) - เหตุผล: ${request.review_notes}`,
    target_user: request.officer_name,
    timestamp: request.reviewed_at
  });

  res.json({ success: true, request });
});

// Validation Layer / Anomalies
app.get('/api/validation/anomalies', (req, res) => {
  res.json({ anomalies: anomalyLogs });
});

app.post('/api/validation/scan', (req, res) => {
  // Automated verification engine comparing case logs against duty logs
  const detected: AnomalyLog[] = [];

  caseLogs.forEach(c => {
    // Check if officer had an active duty at the timestamp
    const cDate = new Date(c.timestamp).getTime();
    const matchingDuty = dutyLogs.find(d => {
      if (d.officer_discord_id !== c.officer_discord_id) return false;
      const inTime = new Date(d.clock_in).getTime();
      const outTime = d.clock_out ? new Date(d.clock_out).getTime() : Date.now();
      return cDate >= (inTime - 15 * 60 * 1000) && cDate <= (outTime + 15 * 60 * 1000);
    });

    if (!matchingDuty && !anomalyLogs.find(a => a.case_id === c.id)) {
      const anomaly: AnomalyLog = {
        id: `ANOMALY-${Date.now().toString().slice(-4)}-${Math.floor(Math.random()*100)}`,
        officer_discord_id: c.officer_discord_id,
        officer_name: c.officer_name,
        badge_number: c.badge_number,
        type: "CASE_OUTSIDE_DUTY",
        description: `ตรวจพบคดี ${c.case_type} (${c.case_number}) เมื่อ ${c.timestamp} โดยไม่มีบันทึกการเข้าเวรในช่วงเวลาดังกล่าว`,
        case_id: c.id,
        case_number: c.case_number,
        case_type: c.case_type,
        timestamp: c.timestamp,
        severity: c.case_type === 'Red' ? 'critical' : 'warning',
        status: 'Unresolved'
      };
      anomalyLogs.unshift(anomaly);
      detected.push(anomaly);
    }
  });

  res.json({ success: true, detected_count: detected.length, anomalies: anomalyLogs });
});

app.post('/api/validation/resolve', (req, res) => {
  const { anomaly_id, action, note } = req.body; // action: 'Approve' | 'Dismiss'
  const anomaly = anomalyLogs.find(a => a.id === anomaly_id);
  if (!anomaly) return res.status(404).json({ error: "Anomaly not found" });

  const admin = officers.find(o => o.discord_id === currentUserId);
  anomaly.status = action === 'Approve' ? 'Approved' : 'Dismissed';
  anomaly.resolution_note = `${action === 'Approve' ? 'อนุมัติข้อยกเว้นพิเศษ' : 'ตัดสิทธิ์คดี/ยกเลิก'} โดย ${admin?.officer_name || 'Admin'} - หมายเหตุ: ${note || '-'}`;

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: currentUserId,
    admin_name: admin?.officer_name || "Admin",
    action_type: "ANOMALY_RESOLVED",
    action_details: `จัดการความผิดปกติ ${anomaly.type} (${anomaly.case_number || anomaly.officer_name}): ${anomaly.status}`,
    target_user: anomaly.officer_name,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
  });

  res.json({ success: true, anomaly });
});

// Payroll & Case Reward Calculator
app.get('/api/payroll/current', (req, res) => {
  // Generate real-time payroll items for each officer based on actual case counts and rates
  const items: PayrollItem[] = officers.map(o => {
    const normal = o.cases_normal;
    const take2 = o.cases_take2;
    const red = o.cases_red;
    const total_cases = normal + take2 + red;

    const reward_normal = normal * payrollRates.rate_normal;
    const reward_take2 = take2 * payrollRates.rate_take2;
    const reward_red = red * payrollRates.rate_red;
    const reward_duty = Math.round(o.duty_hours * payrollRates.rate_duty_hour);
    const base_salary = payrollRates.base_salary;
    const bonus = (o.rank.includes('Chief') || o.rank.includes('Commander')) ? 5000 : (o.rank.includes('Lieutenant') || o.rank.includes('Sergeant')) ? 2500 : 0;
    const deductions = 0;
    const total_payout = base_salary + reward_normal + reward_take2 + reward_red + reward_duty + bonus - deductions;

    return {
      officer_discord_id: o.discord_id,
      officer_name: o.officer_name,
      badge_number: o.badge_number,
      rank: o.rank,
      department: o.department,
      cases_normal: normal,
      cases_take2: take2,
      cases_red: red,
      total_cases,
      duty_hours: o.duty_hours,
      rate_normal: payrollRates.rate_normal,
      rate_take2: payrollRates.rate_take2,
      rate_red: payrollRates.rate_red,
      rate_duty_hour: payrollRates.rate_duty_hour,
      base_salary,
      reward_normal,
      reward_take2,
      reward_red,
      reward_duty,
      bonus,
      deductions,
      total_payout,
      status: 'Draft'
    };
  });

  const grand_total_amount = items.reduce((acc, item) => acc + item.total_payout, 0);
  const grand_total_cases = items.reduce((acc, item) => acc + item.total_cases, 0);
  const grand_total_duty_hours = items.reduce((acc, item) => acc + item.duty_hours, 0);

  res.json({
    rates: payrollRates,
    items,
    grand_total_amount,
    grand_total_cases,
    grand_total_duty_hours,
    officer_count: items.length
  });
});

app.post('/api/payroll/update-rates', (req, res) => {
  const { rate_normal, rate_take2, rate_red, rate_duty_hour, base_salary } = req.body;
  if (rate_normal !== undefined) payrollRates.rate_normal = Number(rate_normal);
  if (rate_take2 !== undefined) payrollRates.rate_take2 = Number(rate_take2);
  if (rate_red !== undefined) payrollRates.rate_red = Number(rate_red);
  if (rate_duty_hour !== undefined) payrollRates.rate_duty_hour = Number(rate_duty_hour);
  if (base_salary !== undefined) payrollRates.base_salary = Number(base_salary);

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: currentUserId,
    admin_name: officers.find(o => o.discord_id === currentUserId)?.officer_name || "Admin",
    action_type: "SETTINGS_UPDATE",
    action_details: `อัปเดตอัตราค่าคดี: ปกติ=${payrollRates.rate_normal}, Take2=${payrollRates.rate_take2}, แดง=${payrollRates.rate_red}, เวร=${payrollRates.rate_duty_hour}/ชม.`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
  });

  res.json({ success: true, rates: payrollRates });
});

app.post('/api/payroll/save-cycle', (req, res) => {
  const { period_name, cycle_start, cycle_end, items, grand_total_amount, grand_total_cases, grand_total_duty_hours } = req.body;
  const newCycle: PayrollPeriod = {
    id: `PAYROLL-${Date.now().toString().slice(-4)}`,
    period_name: period_name || `รอบการจ่าย ${new Date().toLocaleDateString('th-TH')}`,
    cycle_start: cycle_start || new Date().toISOString().split('T')[0],
    cycle_end: cycle_end || new Date().toISOString().split('T')[0],
    rates: { ...payrollRates },
    items: items || [],
    grand_total_amount: Number(grand_total_amount) || 0,
    grand_total_cases: Number(grand_total_cases) || 0,
    grand_total_duty_hours: Number(grand_total_duty_hours) || 0,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
    status: 'Active'
  };

  payrollCycles.unshift(newCycle);

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: currentUserId,
    admin_name: officers.find(o => o.discord_id === currentUserId)?.officer_name || "Admin",
    action_type: "PAYROLL_CALC",
    action_details: `บันทึกรอบการจ่ายเงิน ${newCycle.period_name} ยอดรวม ฿${newCycle.grand_total_amount.toLocaleString()}`,
    timestamp: newCycle.created_at
  });

  res.json({ success: true, cycle: newCycle });
});

app.get('/api/payroll/cycles', (req, res) => {
  res.json({ cycles: payrollCycles });
});

// Audit Logs Endpoint
app.get('/api/audit-logs', (req, res) => {
  res.json({ auditLogs });
});

// Activities & SOP Training Quizzes
app.get('/api/activities', (req, res) => {
  res.json({ activities });
});

app.post('/api/activities/vote', (req, res) => {
  const { activity_id, vote_type } = req.body; // vote_type: 'up' | 'down'
  const activity = activities.find(a => a.id === activity_id);
  if (!activity) return res.status(404).json({ error: "Activity not found" });

  const existingVote = activity.votes.user_votes[currentUserId];

  if (existingVote === vote_type) {
    // remove vote
    delete activity.votes.user_votes[currentUserId];
    if (vote_type === 'up') activity.votes.up = Math.max(0, activity.votes.up - 1);
    if (vote_type === 'down') activity.votes.down = Math.max(0, activity.votes.down - 1);
  } else {
    if (existingVote === 'up') activity.votes.up = Math.max(0, activity.votes.up - 1);
    if (existingVote === 'down') activity.votes.down = Math.max(0, activity.votes.down - 1);

    activity.votes.user_votes[currentUserId] = vote_type;
    if (vote_type === 'up') activity.votes.up++;
    if (vote_type === 'down') activity.votes.down++;
  }

  res.json({ success: true, activity });
});

app.post('/api/activities/quiz-submit', (req, res) => {
  const { activity_id, answers } = req.body;
  const activity = activities.find(a => a.id === activity_id);
  if (!activity) return res.status(404).json({ error: "ไม่พบกิจกรรม" });
  if (!activity.quiz) return res.status(400).json({ error: "กิจกรรมนี้ไม่ใช่แบบทดสอบ Quiz" });

  let score = 0;
  const questions = activity.quiz.questions || [];
  questions.forEach(q => {
    if (answers && answers[q.id] === q.correct_index) {
      score++;
    }
  });

  if (!activity.quiz.submissions) {
    activity.quiz.submissions = {};
  }
  activity.quiz.submissions[currentUserId] = {
    score,
    max_score: questions.length,
    submitted_at: new Date().toISOString().replace('T', ' ').slice(0, 16)
  };

  res.json({
    success: true,
    score,
    max_score: questions.length,
    activity
  });
});

app.post('/api/activities/create', (req, res) => {
  const { title, description, category, scheduled_time, location, quiz } = req.body;
  if (!title) return res.status(400).json({ error: "กรุณาระบุหัวข้อกิจกรรม" });

  const admin = officers.find(o => o.discord_id === currentUserId);
  const newActivity: ActivityTraining = {
    id: `ACT-${Date.now().toString().slice(-4)}`,
    title,
    description: description || "",
    category: category || "Training",
    scheduled_time: scheduled_time || new Date().toISOString().replace('T', ' ').slice(0, 16),
    location: location || "HQ Room 1",
    creator_name: admin ? admin.officer_name : "ผู้ดูแลระบบ",
    status: "Upcoming",
    votes: {
      up: 0,
      down: 0,
      user_votes: {}
    },
    quiz: quiz || undefined,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 16)
  };

  activities.unshift(newActivity);

  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: currentUserId,
    admin_name: admin?.officer_name || "Admin",
    action_type: "CREATE_ACTIVITY",
    action_details: `สร้างกิจกรรมใหม่: ${title} (${category})`,
    timestamp: newActivity.created_at
  });

  res.json({ success: true, activity: newActivity });
});

// Discord Sync Parser Endpoint (handles both sync-parse and parse-log)
const handleDiscordSyncParse = (req: express.Request, res: express.Response) => {
  const { raw_text } = req.body;
  if (!raw_text) return res.status(400).json({ error: "ข้อความว่างเปล่า" });

  const text = raw_text.trim();
  const isCase = text.includes("คดี") || text.includes("Case") || text.includes("จับกุม") || text.includes("Take 2") || text.includes("แดง") || text.includes("Normal");

  if (isCase) {
    let cType: CaseType = 'Normal';
    if (text.includes("แดง") || text.toLowerCase().includes("red")) cType = 'Red';
    else if (text.includes("Take 2") || text.includes("Take2") || text.toLowerCase().includes("take 2") || text.toLowerCase().includes("take2")) cType = 'Take2';

    let matchedOfficer = officers.find(o => text.includes(o.badge_number) || text.includes(o.officer_name)) || officers[0];
    
    // Check duty status
    const isCurrentlyOnDuty = dutyLogs.some(d => d.officer_discord_id === matchedOfficer.discord_id && d.is_active);

    const mappedType: 'NORMAL' | 'TAKE2' | 'RED_CASE' = cType === 'Red' ? 'RED_CASE' : cType === 'Take2' ? 'TAKE2' : 'NORMAL';
    const nowIso = new Date().toISOString();
    const newCase: CaseLog = {
      id: `CASE-${Date.now().toString().slice(-4)}`,
      case_number: `CASE-${String(caseSeqCounter++).padStart(6, '0')}`,
      type: mappedType,
      title: `คดีประเภท ${cType} - ${matchedOfficer.officer_name}`,
      description: `ตรวจพบจากข้อความ: "${text}"`,
      incident_date: nowIso.split('T')[0],
      incident_time: nowIso.split('T')[1].slice(0, 5),
      location: "Los Santos",
      images: [],
      helpers: [],
      created_by: matchedOfficer.discord_id,
      created_by_name: matchedOfficer.officer_name,
      created_by_badge: matchedOfficer.badge_number,
      created_by_avatar: matchedOfficer.avatar,
      created_by_rank: matchedOfficer.rank,
      status: 'OPEN',
      created_at: nowIso.replace('T', ' ').slice(0, 19),
      updated_at: nowIso.replace('T', ' ').slice(0, 19),
      timeline: [
        {
          id: `TL-${Date.now()}`,
          officer_name: matchedOfficer.officer_name,
          action: 'สร้าง Case',
          details: 'สร้างผ่านระบบอัตโนมัติ',
          timestamp: nowIso.replace('T', ' ').slice(0, 16)
        }
      ],
      // Legacy compatibility
      officer_discord_id: matchedOfficer.discord_id,
      officer_name: matchedOfficer.officer_name,
      badge_number: matchedOfficer.badge_number,
      case_type: cType,
      suspect_name: "ผู้ต้องสงสัยจากระบบ",
      charges: ["ข้อกล่าวหาเบื้องต้น"],
      fine_amount: cType === 'Red' ? 50000 : cType === 'Take2' ? 25000 : 10000,
      jail_time: cType === 'Red' ? 60 : cType === 'Take2' ? 30 : 15,
      timestamp: nowIso.replace('T', ' ').slice(0, 16),
      discord_channel: "web-system",
      notes: `ตรวจพบจากข้อความ: "${text}"`,
      is_anomaly: !isCurrentlyOnDuty
    };

    caseLogs.unshift(newCase);
    matchedOfficer.total_cases++;
    if (cType === 'Normal') matchedOfficer.cases_normal++;
    if (cType === 'Take2') matchedOfficer.cases_take2++;
    if (cType === 'Red') matchedOfficer.cases_red++;

    if (newCase.is_anomaly) {
      anomalyLogs.unshift({
        id: `ANOMALY-${Date.now().toString().slice(-4)}`,
        officer_discord_id: matchedOfficer.discord_id,
        officer_name: matchedOfficer.officer_name,
        badge_number: matchedOfficer.badge_number,
        type: 'CASE_OUTSIDE_DUTY',
        description: `ตรวจพบการบันทึกคดี (${newCase.case_type}) ผ่าน Discord ในขณะที่สถานะนอกเวลางาน (10-7)`,
        case_id: newCase.id,
        case_type: newCase.case_type,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        severity: newCase.case_type === 'Red' ? 'critical' : 'warning',
        status: 'Unresolved'
      });
    }

    res.json({
      success: true,
      action: 'CASE_LOGGED',
      message: `บันทึกคดีประเภท ${newCase.case_type} ของ ${matchedOfficer.officer_name} สำเร็จ`,
      case: newCase,
      matched_officer: matchedOfficer,
      is_anomaly: newCase.is_anomaly
    });
  } else {
    // Treat as duty action or generic command
    res.json({
      success: true,
      action: 'GENERAL_MESSAGE',
      message: `บันทึกข้อความจาก Discord: "${text.slice(0, 50)}..."`
    });
  }
};

app.post('/api/discord/sync-parse', handleDiscordSyncParse);
app.post('/api/discord/parse-log', handleDiscordSyncParse);

// ==========================================
// OCR / Vision AI & Roster Image Import APIs
// ==========================================

// 1. Scan image roster with Gemini Multimodal Vision API
app.post('/api/officers/scan-roster-image', async (req, res) => {
  try {
    const { image_base64, mime_type = 'image/jpeg', deep_scan = true } = req.body;
    if (!image_base64) {
      return res.status(400).json({ error: "กรุณาอัปโหลดรูปภาพรายชื่อตำรวจ" });
    }

    const cleanBase64 = image_base64.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, '').replace(/\s+/g, '');
    const cleanMime = mime_type && mime_type.startsWith('image/') ? mime_type : 'image/jpeg';

    let extractedList: { officer_name: string; rank?: string; badge_number?: string; department?: string }[] = [];
    let lastScanError: string = "";
    const ai = getGemini();

    if (ai) {
      const prompt = `You are an expert OCR transcription AI specialized in Police MDT, FiveM station tables, Discord rosters, and Member Lists.

CRITICAL OCR INSTRUCTIONS:
1. Examine each row of the table/list carefully.
2. In Member List / Roster tables:
   - The officer's full name is in the "ข้อมูลสมาชิก" (Member Info) column or main list row in bold text (e.g. "Masterdeen Daruma", "Just Khonlaradup", "Ferrin Frozen", "Milabel Babywhale", "Delta Burrell", "Nongkathi Chaokoh", "Minton Verodes", "Gina Laloy", "Gucci Ronnachaichanyut", "Manow Zero").
   - Transcribe English and Thai names character-for-character EXACTLY as spelled in the image.
   - Do NOT include sub-labels such as "ออฟไลน์" (Offline), "ออนไลน์" (Online), dates (e.g. "19/08/2569 20:43"), numbers ("0"), or action buttons in the officer_name.
3. In the "ตำแหน่ง" (Rank/Position) column:
   - Extract the rank text (e.g. "นักเรียนตำรวจ", "จ่า", "หมวด", "สารวัตร", "ครูฝึก", "รองผู้บัญชาการตำรวจ", "ผู้บัญชาการตำรวจ").
   - Strictly map to one of:
     * "ผู้บัญชาการตำรวจ" (Chief, ผบ., ผู้การ)
     * "รองผู้บัญชาการตำรวจ" (Deputy Chief, รอง ผบ.)
     * "ครูฝึก" (Trainer, FTO, ครูฝึก)
     * "สารวัตร" (Inspector, Captain, สว.)
     * "หมวด" (Lieutenant, หมวด, ร.ต.)
     * "จ่า" (Sergeant, จ่า, ด.ต.)
     * "นักเรียนตำรวจ" (Cadet, Recruit, Trainee, นักเรียนตำรวจ) - Default if rank is unspecified or cadet
4. In the badge/number column or if there is a prefix ID/Callsign (e.g. #01, [02], 03, 15):
   - Extract the badge number digits if visible as "badge_number" (e.g. "01", "02"). If not explicitly visible, leave empty string.
5. Extract EVERY visible row in order from top to bottom. Do NOT skip or summarize any names.
6. Never invent or hallucinate placeholder names. Only transcribe real names seen in the image.

Output MUST be a strict JSON array of objects:
[
  { "officer_name": "Exact Name Here", "rank": "ยศภาษาไทย", "badge_number": "01" }
]`;

      const imagePart = {
        inlineData: {
          mimeType: cleanMime,
          data: cleanBase64
        }
      };

      // Model priority for multimodal OCR using active supported Gemini 3 models
      const candidateModels = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                imagePart,
                { text: prompt }
              ]
            },
            config: {
              responseMimeType: "application/json"
            }
          });

          let rawText = response.text || "";
          rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

          // Match JSON array or object
          let parsed: any = null;
          try {
            parsed = JSON.parse(rawText);
          } catch {
            const arrayMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (arrayMatch) {
              parsed = JSON.parse(arrayMatch[0]);
            }
          }

          if (parsed) {
            const list = Array.isArray(parsed) ? parsed : (parsed.officers || parsed.roster || parsed.members || []);
            if (Array.isArray(list) && list.length > 0) {
              extractedList = list;
              console.log(`Successfully extracted ${extractedList.length} officers using ${modelName}`);
              break;
            }
          }
        } catch (modelErr: any) {
          lastScanError = modelErr?.message || String(modelErr);
          console.warn(`Model ${modelName} scan failed:`, lastScanError);
        }
      }
    }

    if (extractedList.length === 0) {
      return res.status(422).json({
        error: "ไม่สามารถอ่านรายชื่อจากรูปภาพได้ หรือรูปภาพไม่ชัดเจน กรุณาลองอัปโหลดรูปภาพใหม่ หรือใช้ปุ่ม 'วางข้อความรายชื่อ' เพื่อกรอกรายชื่อโดยตรง"
      });
    }

    // Process each scanned officer and check for duplicates (ถ้ามีรายชื่ออยู่แล้วจะไม่เพิ่มให้)
    const validRanks: OfficerRank[] = [
      'ผู้บัญชาการตำรวจ',
      'รองผู้บัญชาการตำรวจ',
      'ครูฝึก',
      'สารวัตร',
      'หมวด',
      'จ่า',
      'นักเรียนตำรวจ'
    ];

    // Find taken badge numbers to fill in free slots starting from 01 sequentially
    const takenBadges = new Set(officers.map(o => o.badge_number.trim()));
    let nextFreeBadgeNumber = 1;

    const scanned_officers: ScannedOfficer[] = extractedList.map((item, idx) => {
      let rawName = (item.officer_name || `Officer ${idx + 1}`).trim();
      rawName = rawName.replace(/^([#\d]+[\.\-\s:]+)/, '').trim();

      const norm = normalizeOfficerName(rawName);

      // Check if officer already exists in system database
      const existing = officers.find(o => 
        normalizeOfficerName(o.officer_name) === norm ||
        o.officer_name.trim().toLowerCase() === rawName.toLowerCase()
      );

      let matchedRank: OfficerRank = 'นักเรียนตำรวจ';
      const rankSource = (item.rank || rawName).toLowerCase();

      if (item.rank) {
        const found = validRanks.find(r => r.toLowerCase() === item.rank?.toLowerCase());
        if (found) matchedRank = found;
        else if (item.rank.includes('ผู้บัญชาการ') && item.rank.includes('รอง')) matchedRank = 'รองผู้บัญชาการตำรวจ';
        else if (item.rank.includes('ผู้บัญชาการ') || item.rank.includes('ผบ.') || item.rank.toLowerCase().includes('chief')) matchedRank = 'ผู้บัญชาการตำรวจ';
        else if (item.rank.includes('ครูฝึก') || item.rank.toLowerCase().includes('trainer') || item.rank.toLowerCase().includes('fto')) matchedRank = 'ครูฝึก';
        else if (item.rank.includes('สารวัตร') || item.rank.includes('สว.') || item.rank.toLowerCase().includes('inspector') || item.rank.toLowerCase().includes('captain')) matchedRank = 'สารวัตร';
        else if (item.rank.includes('หมวด') || item.rank.includes('ร.ต.') || item.rank.toLowerCase().includes('lieutenant')) matchedRank = 'หมวด';
        else if (item.rank.includes('จ่า') || item.rank.includes('ด.ต.') || item.rank.includes('ส.ต.') || item.rank.toLowerCase().includes('sergeant') || item.rank.toLowerCase().includes('corporal')) matchedRank = 'จ่า';
        else if (item.rank.includes('นักเรียน') || item.rank.includes('นรต.') || item.rank.toLowerCase().includes('cadet') || item.rank.toLowerCase().includes('recruit')) matchedRank = 'นักเรียนตำรวจ';
      } else {
        // Infer rank if embedded in name
        if (rankSource.includes('ผู้บัญชาการ') && rankSource.includes('รอง')) {
          matchedRank = 'รองผู้บัญชาการตำรวจ';
          rawName = rawName.replace(/รองผู้บัญชาการตำรวจ|รอง ผบ\.|รองผู้การ/gi, '').trim();
        } else if (rankSource.includes('ผู้บัญชาการ') || rankSource.includes('ผบ.') || rankSource.includes('chief')) {
          matchedRank = 'ผู้บัญชาการตำรวจ';
          rawName = rawName.replace(/ผู้บัญชาการตำรวจ|ผู้บัญชาการ|ผบ\.|Chief/gi, '').trim();
        } else if (rankSource.includes('ครูฝึก') || rankSource.includes('trainer') || rankSource.includes('fto')) {
          matchedRank = 'ครูฝึก';
          rawName = rawName.replace(/ครูฝึก|Trainer|FTO/gi, '').trim();
        } else if (rankSource.includes('สารวัตร') || rankSource.includes('สว.') || rankSource.includes('inspector') || rankSource.includes('captain')) {
          matchedRank = 'สารวัตร';
          rawName = rawName.replace(/สารวัตร|สว\.|Inspector|Captain/gi, '').trim();
        } else if (rankSource.includes('หมวด') || rankSource.includes('ร.ต.') || rankSource.includes('lieutenant')) {
          matchedRank = 'หมวด';
          rawName = rawName.replace(/ผู้หมวด|หมวด|ร\.ต\.|Lieutenant/gi, '').trim();
        } else if (rankSource.includes('จ่า') || rankSource.includes('ด.ต.') || rankSource.includes('ส.ต.') || rankSource.includes('sergeant')) {
          matchedRank = 'จ่า';
          rawName = rawName.replace(/จ่า|ด\.ต\.|ส\.ต\.|Sergeant/gi, '').trim();
        } else if (rankSource.includes('นักเรียน') || rankSource.includes('นรต.') || rankSource.includes('cadet') || rankSource.includes('recruit')) {
          matchedRank = 'นักเรียนตำรวจ';
          rawName = rawName.replace(/นักเรียนตำรวจ|นรต\.|Cadet|Recruit/gi, '').trim();
        }
      }

      // Auto-assign sequential badge number starting from 01 filling available slots or respect scanned badge
      let assignedBadge = "";
      if (existing) {
        assignedBadge = existing.badge_number;
      } else {
        const rawBadge = item.badge_number ? item.badge_number.replace(/\D/g, '') : '';
        if (rawBadge && !takenBadges.has(rawBadge.padStart(2, '0'))) {
          assignedBadge = rawBadge.padStart(2, '0');
          takenBadges.add(assignedBadge);
        } else {
          while (takenBadges.has(nextFreeBadgeNumber < 10 ? `0${nextFreeBadgeNumber}` : `${nextFreeBadgeNumber}`)) {
            nextFreeBadgeNumber++;
          }
          assignedBadge = nextFreeBadgeNumber < 10 ? `0${nextFreeBadgeNumber}` : `${nextFreeBadgeNumber}`;
          takenBadges.add(assignedBadge);
          nextFreeBadgeNumber++;
        }
      }

      return {
        id: `SCAN-${Date.now()}-${idx}`,
        officer_name: rawName,
        rank: matchedRank,
        badge_number: assignedBadge,
        department: item.department || (matchedRank === 'ผู้บัญชาการตำรวจ' || matchedRank === 'รองผู้บัญชาการตำรวจ' ? 'High Command' : 'Patrol Division'),
        role: (matchedRank === 'ผู้บัญชาการตำรวจ' || matchedRank === 'รองผู้บัญชาการตำรวจ') ? 'Leader' : (matchedRank === 'ครูฝึก' || matchedRank === 'สารวัตร') ? 'Admin' : 'Member',
        already_exists: !!existing,
        existing_badge: existing?.badge_number,
        existing_rank: existing?.rank,
        selected_for_import: !existing
      };
    });

    const duplicate_count = scanned_officers.filter(s => s.already_exists).length;
    const new_count = scanned_officers.filter(s => !s.already_exists).length;

    res.json({
      success: true,
      scanned_officers,
      total_scanned: scanned_officers.length,
      new_count,
      duplicate_count
    });

  } catch (err: any) {
    console.error("OCR Roster Scan Error:", err);
    res.status(500).json({ error: err.message || "Failed to scan image roster" });
  }
});

// 2. Apply batch scanned roster: Deduplicate + Auto Sort A-Z & Sequential Badge Numbering
app.post('/api/officers/apply-batch-roster', (req, res) => {
  const { officers_to_add = [], auto_sort_az_and_renumber = true } = req.body;

  const added: Officer[] = [];
  let skipped_count = 0;

  const sampleAvatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80"
  ];

  officers_to_add.forEach((item: Partial<ScannedOfficer>, idx: number) => {
    if (!item.officer_name) return;

    // Strict duplicate check: ถ้ามีรายชื่ออยู่แล้วจะไม่เพิ่มให้
    const norm = normalizeOfficerName(item.officer_name);
    const existing = officers.find(o => 
      normalizeOfficerName(o.officer_name) === norm ||
      o.officer_name.trim().toLowerCase() === item.officer_name!.trim().toLowerCase()
    );

    if (existing) {
      skipped_count++;
      return; // Skip duplicate!
    }

    // Assign badge: if item has a valid unassigned badge use it, otherwise find lowest available number
    let assignedBadge = '';
    if (item.badge_number) {
      const parsed = parseInt(item.badge_number, 10);
      if (!isNaN(parsed) && parsed > 0) {
        const formatted = formatBadgeNumber(parsed);
        const inUse = officers.some(o => o.badge_number === formatted);
        if (!inUse) {
          assignedBadge = formatted;
        }
      }
    }
    if (!assignedBadge) {
      assignedBadge = getNextAvailableBadgeNumber().formatted;
    }

    const rank = item.rank || 'นักเรียนตำรวจ';
    const role = item.role || ((rank === 'ผู้บัญชาการตำรวจ' || rank === 'รองผู้บัญชาการตำรวจ') ? 'Leader' : (rank === 'ครูฝึก' || rank === 'สารวัตร') ? 'Admin' : 'Member');
    const dept = (item.department as any) || 'Patrol Division';
    const isCommand = role === 'Leader' || role === 'Admin' || rank === 'ผู้บัญชาการตำรวจ' || rank === 'รองผู้บัญชาการตำรวจ' || rank === 'สารวัตร';
    const prefix = isCommand ? 'COMMAND' : dept === 'SWAT / Special Response' ? 'SIERRA' : dept === 'Traffic Enforcement' ? 'ECHO' : dept === 'Criminal Investigation (CID)' ? 'KILO' : 'DELTA';

    const newOfficer: Officer = {
      discord_id: `${Date.now()}${idx}${Math.floor(Math.random() * 1000)}`,
      officer_name: item.officer_name.trim(),
      callsign: `${prefix}-${assignedBadge}`,
      avatar: sampleAvatars[(officers.length + added.length) % sampleAvatars.length],
      badge_number: assignedBadge,
      rank: rank,
      role: role,
      duty_hours: 0,
      total_cases: 0,
      cases_normal: 0,
      cases_take2: 0,
      cases_red: 0,
      citations_count: 0,
      status: 'Off Duty',
      department: dept,
      join_date: new Date().toISOString().split('T')[0],
      last_active: 'เพิ่งเพิ่มเข้าระบบ',
      phone_number: `555-01${(officers.length + added.length + 10).toString().slice(-2)}`
    };

    officers.push(newOfficer);
    added.push(newOfficer);
  });

  // Re-sort all officers A-Z and sequentially re-assign badge numbers #01, #02... ONLY if explicitly requested
  if (auto_sort_az_and_renumber) {
    sortAndRenumberOfficersAZ();
  } else {
    sortOfficersByBadgeAsc(officers);
  }

  const admin = officers.find(o => o.discord_id === currentUserId);
  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: currentUserId,
    admin_name: admin?.officer_name || "Admin",
    action_type: "ROSTER_OCR_IMPORT",
    action_details: `สแกนอัปโหลดรูปรายชื่อ: เพิ่มตำรวจใหม่ ${added.length} นาย (ข้ามชื่อซ้ำ ${skipped_count} นาย) พร้อมจัดเรียงรายชื่อ A-Z และรันหมายเลขประจำตัว (#01 - #${officers.length.toString().padStart(2, '0')})`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
  });

  res.json({
    success: true,
    added_count: added.length,
    skipped_count,
    total_officers: officers.length,
    officers,
    message: `เพิ่มเจ้าหน้าที่ใหม่ ${added.length} นาย (ข้ามรายชื่อซ้ำ ${skipped_count} นาย) และจัดเรียงเลขตามรายชื่อ A-Z สำเร็จ`
  });
});

// 3. Manual Re-sort A-Z and Sequential Badge Renumbering
app.post('/api/officers/reorder-az-badges', (req, res) => {
  sortAndRenumberOfficersAZ();

  const admin = officers.find(o => o.discord_id === currentUserId);
  auditLogs.unshift({
    id: `AUDIT-${Date.now()}`,
    admin_discord_id: currentUserId,
    admin_name: admin?.officer_name || "Admin",
    action_type: "BADGE_AZ_REORDER",
    action_details: `จัดเรียงรายชื่อตำรวจสถานีทั้งหมดตามลำดับตัวอักษร A-Z และกำหนดหมายเลขประจำตัว (#01 - #${officers.length.toString().padStart(2, '0')}) ใหม่อัตโนมัติ`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
  });

  res.json({
    success: true,
    total_officers: officers.length,
    officers,
    message: `จัดเรียงรายชื่อ A-Z และรันเลขประจำตัว #${officers[0]?.badge_number || '01'} ถึง #${officers[officers.length - 1]?.badge_number || '01'} เรียบร้อย`
  });
});

// 4. Check existence of officer name(s) in system database
app.post('/api/officers/check-existence', (req, res) => {
  const { query, names = [] } = req.body;
  
  const queryList: string[] = [];
  if (query && typeof query === 'string' && query.trim()) {
    queryList.push(query.trim());
  }
  if (Array.isArray(names)) {
    names.forEach(n => {
      if (typeof n === 'string' && n.trim()) {
        queryList.push(n.trim());
      }
    });
  }

  if (queryList.length === 0) {
    return res.status(400).json({ error: "กรุณาระบุชื่อที่ต้องการตรวจสอบ" });
  }

  const results = queryList.map(q => {
    const rawQuery = q.trim();
    const normQuery = normalizeOfficerName(rawQuery);
    const badgeDigits = rawQuery.replace(/\D/g, '');

    // 1. Exact match
    let matched = officers.find(o => o.officer_name.toLowerCase() === rawQuery.toLowerCase());
    let matchType: 'exact' | 'normalized' | 'badge' | 'callsign' | 'partial' | 'none' = 'none';

    if (matched) {
      matchType = 'exact';
    } else {
      // 2. Normalized match
      matched = officers.find(o => normalizeOfficerName(o.officer_name) === normQuery && normQuery.length > 1);
      if (matched) {
        matchType = 'normalized';
      } else if (rawQuery.startsWith('#') || (badgeDigits.length > 0 && badgeDigits.length <= 3 && rawQuery.length <= 4)) {
        // 3. Badge match
        const searchBadge = badgeDigits.padStart(2, '0');
        matched = officers.find(o => o.badge_number === searchBadge || o.badge_number === badgeDigits);
        if (matched) matchType = 'badge';
      }

      // 4. Callsign match
      if (!matched) {
        matched = officers.find(o => o.callsign.toLowerCase() === rawQuery.toLowerCase());
        if (matched) matchType = 'callsign';
      }

      // 5. Partial substring match
      if (!matched && rawQuery.length >= 3) {
        matched = officers.find(o => 
          o.officer_name.toLowerCase().includes(rawQuery.toLowerCase()) ||
          rawQuery.toLowerCase().includes(o.officer_name.toLowerCase())
        );
        if (matched) matchType = 'partial';
      }
    }

    return {
      query_name: rawQuery,
      exists: !!matched,
      match_type: matchType,
      matched_officer: matched || null
    };
  });

  const total_checked = results.length;
  const found_count = results.filter(r => r.exists).length;
  const not_found_count = total_checked - found_count;

  res.json({
    success: true,
    total_checked,
    found_count,
    not_found_count,
    results
  });
});

// -------------------------------------------------------------
// VITE OR STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Around Town Police MDT] Server running on port ${PORT}`);
});
    const isIdSet = Boolean((process.env.DISCORD_CLIENT_ID || runtimeDiscordClientId || '').trim());
    const isSecretSet = Boolean((process.env.DISCORD_CLIENT_SECRET || runtimeDiscordClientSecret || '').trim());
    const effectiveRedirectUri = (process.env.DISCORD_REDIRECT_URI || '').trim() || `http://localhost:${PORT}/auth/discord/callback`;
    console.log(`[Discord OAuth] Client ID configured: ${isIdSet}`);
    console.log(`[Discord OAuth] Client Secret configured: ${isSecretSet}`);
    console.log(`[Discord OAuth] Redirect URI: ${effectiveRedirectUri}`);
    const adminList = getAdminDiscordIds();
    console.log(`[Discord OAuth] Admin Discord IDs: ${adminList.length > 0 ? adminList.join(', ') : '(None - Set via DISCORD_ADMIN_IDS in .env)'}`);
  });
}

startServer();
