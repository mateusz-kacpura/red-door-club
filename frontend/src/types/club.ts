/**
 * Red Door Club domain types.
 */

export interface NfcCard {
  id: string;
  card_id: string;
  status: "unbound" | "active" | "suspended" | "lost" | "replaced";
  tier_at_issue: string | null;
  issued_at: string | null;
  bound_at: string | null;
  last_tap_at: string | null;
  tap_count: number;
  member_id: string | null;
}

export interface TapEvent {
  id: string;
  card_id: string;
  tap_type: string;
  reader_id: string | null;
  location: string | null;
  metadata_: Record<string, unknown> | null;
  tapped_at: string;
  member_id: string | null;
}

export interface TapResponse {
  action:
    | "setup"
    | "welcome"
    | "card_suspended"
    | "connection_made"
    | "payment_added"
    | "locker_assigned"
    | "locker_released"
    | "locker_occupied"
    | "locker_already_assigned";
  redirect_url: string | null;
  member_id: string | null;
  message: string | null;
  member_name: string | null;
}

export interface Locker {
  id: string;
  locker_number: string;
  location: string;
  status: "available" | "occupied";
  assigned_member_id: string | null;
  assigned_at: string | null;
  released_at: string | null;
}

export interface TabItem {
  id: string;
  description: string;
  amount: number;
  added_at: string;
  tap_event_id: string | null;
}

export interface Tab {
  id: string;
  member_id: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  total_amount: number;
  items: TabItem[];
}

export interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: "mixer" | "dinner" | "workshop" | "private_party" | "podcast" | "corporate";
  target_segments: string[];
  capacity: number;
  ticket_price: string;
  starts_at: string;
  ends_at: string | null;
  status: "draft" | "published" | "sold_out" | "completed" | "cancelled";
  min_tier: string | null;
  match_score: number | null;
  rsvp_count: number | null;
  is_rsvped: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface UserSummary {
  id: string;
  full_name: string | null;
  company_name: string | null;
  industry: string | null;
  tier: string | null;
}

export interface Connection {
  id: string;
  member_a_id: string;
  member_b_id: string;
  connection_type: "tap" | "staff_intro" | "event_match" | "manual";
  notes: string | null;
  created_at: string;
  other_member: UserSummary | null;
}

export interface ServiceRequest {
  id: string;
  member_id: string;
  request_type: "car" | "driver" | "jet" | "hotel" | "restaurant" | "bar" | "studio" | "other";
  status: "pending" | "acknowledged" | "in_progress" | "completed" | "cancelled";
  details: Record<string, unknown> | null;
  assigned_to: string | null;
  created_at: string;
  completed_at: string | null;
  member_rating: number | null;
}

export interface AnalyticsOverview {
  total_members: number;
  total_prospects: number;
  active_today: number;
  events_this_week: number;
}

export interface FloorEntry {
  member_id: string;
  full_name: string | null;
  company_name: string | null;
  tier: string | null;
  entry_time: string | null;
  location: string | null;
}

export interface ClubMember {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  industry: string | null;
  revenue_range: string | null;
  interests: string[];
  user_type: string;
  tier: string | null;
  segment_groups: string[];
  pdpa_consent: boolean;
  last_seen_at: string | null;
  is_active: boolean;
  role: string;
  created_at: string;
  staff_notes?: string | null;
  phone?: string | null;
}

export interface MemberDetail extends ClubMember {
  connections_count: number;
  tab_total: number;
  service_requests_count: number;
  recent_taps: TapEventAdminRead[];
}

export interface ServiceRequestAdminRead extends ServiceRequest {
  member_name: string | null;
  assigned_to_name: string | null;
}

export interface TapEventAdminRead {
  id: string;
  member_id: string | null;
  member_name: string | null;
  card_id: string;
  tap_type: string;
  reader_id: string | null;
  location: string | null;
  tapped_at: string;
  metadata: Record<string, unknown> | null;
}

export interface TopSpender {
  member_id: string;
  full_name: string | null;
  total_spent: number;
}

export interface RevenueAnalytics {
  today: number;
  this_week: number;
  this_month: number;
  top_spenders: TopSpender[];
}
