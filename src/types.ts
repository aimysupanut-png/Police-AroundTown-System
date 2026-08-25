export type OfficerRole = 'Member' | 'Admin' | 'Leader';

export type OfficerRank = 
  | 'ผู้บัญชาการตำรวจ'
  | 'รองผู้บัญชาการตำรวจ'
  | 'ครูฝึก'
  | 'สารวัตร'
  | 'หมวด'
  | 'จ่า'
  | 'นักเรียนตำรวจ';

export type OfficerStatus = 'On Duty' | 'Off Duty' | 'In Action' | 'On Break' | '10-8' | '10-7' | '10-6';

export interface Officer {
  discord_id: string;
  discord_username?: string;
  discord_global_name?: string;
  officer_name: string;
  callsign: string;
  avatar: string;
  badge_number: string;
  rank: OfficerRank;
  role: OfficerRole;
  duty_hours: number;
  total_cases: number;
  cases_normal: number;
  cases_take2: number;
  cases_red: number;
  citations_count: number;
  status: OfficerStatus;
  department: 'High Command' | 'Patrol Division' | 'SWAT / Special Response' | 'Traffic Enforcement' | 'Criminal Investigation (CID)';
  join_date: string;
  last_active: string;
  phone_number?: string;
}

export type CaseType = 'NORMAL' | 'TAKE2' | 'RED_CASE' | 'Normal' | 'Take2' | 'Red';
export type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface CaseImage {
  id: string;
  case_id: string;
  url: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  size?: number;
  created_at: string;
}

export interface CaseHelper {
  id: string;
  case_id: string;
  user_id: string; // discord_id
  officer_name: string;
  badge_number: string;
  avatar?: string;
  rank?: OfficerRank;
  created_at: string;
}

export interface CaseTimelineItem {
  id: string;
  timestamp: string;
  officer_name: string;
  action: string;
  details?: string;
}

export interface CaseLog {
  id: string;
  case_number: string; // e.g. "CASE-000001"
  type: 'NORMAL' | 'TAKE2' | 'RED_CASE';
  title: string;
  description: string;
  incident_date: string;
  incident_time: string;
  location?: string;
  created_by: string; // discord_id
  created_by_name?: string;
  created_by_badge?: string;
  created_by_avatar?: string;
  created_by_rank?: OfficerRank;
  status: CaseStatus;
  images: CaseImage[];
  helpers: CaseHelper[];
  notes?: string;
  timeline?: CaseTimelineItem[];
  created_at: string;
  updated_at: string;

  // Compatibility fields with previous subsystem & payroll
  officer_discord_id?: string;
  officer_name?: string;
  badge_number?: string;
  case_type?: CaseType;
  suspect_name?: string;
  charges?: string[];
  fine_amount?: number;
  jail_time?: number;
  timestamp?: string;
  discord_channel?: string;
  discord_msg_id?: string;
  is_anomaly?: boolean;
  anomaly_reason?: string;
}

export interface TaggedOfficerRef {
  discord_id: string;
  officer_name: string;
  badge_number: string;
  avatar?: string;
  rank?: string;
}

export interface CaseEditRequest {
  id: string;
  case_id: string;
  case_number: string;
  original_title: string;
  original_type: 'NORMAL' | 'TAKE2' | 'RED_CASE';
  original_fine?: number;
  original_description?: string;

  requested_title: string;
  requested_type: 'NORMAL' | 'TAKE2' | 'RED_CASE';
  requested_fine?: number;
  requested_description?: string;

  reason: string;
  requester_discord_id: string;
  requester_name: string;
  requester_badge: string;
  requester_avatar?: string;
  requester_rank?: OfficerRank;

  mentioned_officers: TaggedOfficerRef[];

  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;

  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export interface AppNotification {
  id: string;
  user_id: string; // recipient discord_id
  case_id: string;
  case_number: string;
  case_type: 'NORMAL' | 'TAKE2' | 'RED_CASE';
  type: 'CASE_TAGGED' | 'CASE_STATUS_CHANGED' | 'CASE_EDIT_REQUESTED' | 'CASE_EDIT_APPROVED' | 'CASE_EDIT_REJECTED' | 'SYSTEM';
  message: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  read: boolean;
  created_at: string;
}

export interface DutyLog {
  id: string;
  officer_discord_id: string;
  officer_name: string;
  badge_number: string;
  clock_in: string;
  clock_in_iso?: string;
  clock_in_timestamp?: number;
  clock_out?: string;
  clock_out_iso?: string;
  clock_out_timestamp?: number;
  duration_minutes: number;
  duration_seconds?: number;
  is_active: boolean;
  notes?: string;
}

export type BadgeStatus = 'Available' | 'Busy' | 'Pending';

export interface BadgeSlot {
  badge_number: string;
  status: BadgeStatus;
  assigned_officer?: {
    discord_id: string;
    officer_name: string;
    rank: OfficerRank;
    avatar: string;
  };
  pending_request?: {
    id: string;
    officer_name: string;
    current_badge: string;
  };
}

export interface BadgeRequest {
  id: string;
  officer_discord_id: string;
  officer_name: string;
  officer_avatar: string;
  officer_rank: OfficerRank;
  current_badge: string;
  requested_badge: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
}

export interface AnomalyLog {
  id: string;
  officer_discord_id: string;
  officer_name: string;
  badge_number: string;
  type: 'NO_DUTY_CASE' | 'CASE_OUTSIDE_DUTY' | 'OVERLAPPING_DUTY' | 'RAPID_FIRE_CASES';
  description: string;
  case_id?: string;
  case_number?: string;
  case_type?: CaseType;
  timestamp: string;
  severity: 'warning' | 'critical';
  status: 'Unresolved' | 'Approved' | 'Dismissed';
  resolution_note?: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

export interface ActivityTraining {
  id: string;
  title: string;
  activity_type?: 'quiz' | 'vote';
  category: 'Quiz' | 'Vote' | 'Operation' | 'Training' | 'SOP Quiz' | 'Briefing';
  description: string;
  end_time?: string;
  scheduled_time?: string;
  location?: string;
  creator_name: string;
  status: 'Upcoming' | 'Active' | 'Completed';
  votes: {
    up: number;
    down: number;
    user_votes: Record<string, 'up' | 'down'>;
  };
  quiz?: {
    questions: QuizQuestion[];
    submissions: Record<string, { score: number; max_score: number; submitted_at: string }>;
  };
  created_at: string;
}

export interface PayrollRates {
  rate_normal: number;   // e.g. 1000
  rate_take2: number;    // e.g. 2500
  rate_red: number;      // e.g. 5000
  rate_duty_hour: number;// e.g. 300
  base_salary: number;   // e.g. 2000
}

export interface PayrollItem {
  officer_discord_id: string;
  officer_name: string;
  badge_number: string;
  rank: OfficerRank;
  department: string;
  cases_normal: number;
  cases_take2: number;
  cases_red: number;
  total_cases: number;
  duty_hours: number;
  rate_normal: number;
  rate_take2: number;
  rate_red: number;
  rate_duty_hour: number;
  base_salary: number;
  reward_normal: number;
  reward_take2: number;
  reward_red: number;
  reward_duty: number;
  bonus: number;
  deductions: number;
  total_payout: number;
  status: 'Draft' | 'Approved' | 'Paid';
  notes?: string;
}

export interface PayrollPeriod {
  id: string;
  period_name: string;
  cycle_start: string;
  cycle_end: string;
  rates: PayrollRates;
  items: PayrollItem[];
  grand_total_amount: number;
  grand_total_cases: number;
  grand_total_duty_hours: number;
  created_at: string;
  status: 'Active' | 'Archived' | 'Finalized';
}

export interface ScannedOfficer {
  id: string;
  officer_name: string;
  rank: OfficerRank;
  role?: OfficerRole;
  badge_number?: string;
  department?: string;
  already_exists: boolean;
  existing_badge?: string;
  existing_rank?: string;
  selected_for_import?: boolean;
}

export interface BatchRosterScanResult {
  scanned_officers: ScannedOfficer[];
  total_scanned: number;
  new_count: number;
  duplicate_count: number;
}

export interface ExistenceCheckResultItem {
  query_name: string;
  exists: boolean;
  match_type: 'exact' | 'normalized' | 'badge' | 'callsign' | 'partial' | 'none';
  matched_officer: Officer | null;
}

export interface ExistenceCheckResponse {
  success: boolean;
  total_checked: number;
  found_count: number;
  not_found_count: number;
  results: ExistenceCheckResultItem[];
}

export interface AuditLog {
  id: string;
  admin_discord_id: string;
  admin_name: string;
  action_type: 'BADGE_APPROVAL' | 'BADGE_REJECTION' | 'PAYROLL_CALC' | 'ANOMALY_RESOLVED' | 'DISCORD_SYNC' | 'OFFICER_UPDATE' | 'DUTY_OVERRIDE' | 'SETTINGS_UPDATE' | 'ROSTER_OCR_IMPORT' | 'BADGE_AZ_REORDER' | 'CREATE_ACTIVITY';
  action_details: string;
  target_user?: string;
  timestamp: string;
}
