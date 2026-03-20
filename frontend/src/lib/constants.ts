/**
 * Application constants.
 */

export const APP_NAME = "red_door";
export const APP_DESCRIPTION = "A FastAPI project";

// API Routes (Next.js internal routes)
export const API_ROUTES = {
  // Auth
  LOGIN: "/auth/login",
  REGISTER: "/auth/register",
  LOGOUT: "/auth/logout",
  REFRESH: "/auth/refresh",
  ME: "/auth/me",

  // Health
  HEALTH: "/health",

  // Users
  USERS: "/users",

  // NFC
  NFC_TAP: "/nfc/tap",
  NFC_BIND: "/nfc/bind",
  NFC_MY_CARDS: "/nfc/my-cards",

  // Members
  MEMBERS_ME: "/members/me",
  MEMBERS_ME_EVENTS: "/members/events",
  MEMBERS_ME_CONNECTIONS: "/members/connections",
  MEMBERS_ME_TAPS: "/members/taps",
  MEMBERS_ME_SERVICES: "/members/services",
  MEMBERS_PRE_ARRIVAL: "/members/pre-arrival",

  // Events
  EVENTS: "/events",

  // Admin
  ADMIN_MEMBERS: "/admin/members",
  ADMIN_FLOOR: "/admin/floor",
  ADMIN_CHECKLIST: "/admin/checklist",
  ADMIN_ANALYTICS: "/admin/analytics",
  ADMIN_EVENTS: "/admin/events",

  // NFC Phase 2
  NFC_CONNECTION_TAP: "/nfc/connection-tap",
  NFC_PAYMENT_TAP: "/nfc/payment-tap",
  NFC_LOCKER_TAP: "/nfc/locker-tap",
  MEMBERS_ME_LOCKER: "/members/locker",
  MEMBERS_ME_TAB: "/members/tab",
  ADMIN_LOCKERS: "/admin/lockers",
  ADMIN_TABS: "/admin/tabs",
} as const;

// Navigation routes
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  QR_REGISTER: "/qr-register",
  NFC_TAP: "/tap",
  NFC_SETUP: "/setup",
  DASHBOARD: "/dashboard",
  PROFILE: "/profile",
  SETTINGS: "/settings",
  EVENTS: "/dashboard/events",
  CONNECTIONS: "/dashboard/connections",
  SERVICES: "/dashboard/services",
  ADMIN: "/admin",
  ADMIN_MEMBERS: "/admin/members",
  ADMIN_EVENTS: "/admin/events",
  ADMIN_FLOOR: "/admin/floor",
  ADMIN_CHECKLIST: "/admin/checklist",
  ADMIN_ANALYTICS: "/admin/analytics",
  // Phase 2
  LOCKER: "/dashboard/locker",
  TAB: "/dashboard/tab",
  ADMIN_LOCKERS: "/admin/lockers",
  ADMIN_TABS: "/admin/tabs",
  // Phase 3
  ADMIN_SERVICES: "/admin/services",
  ADMIN_ACTIVITY: "/admin/activity",
  // Phase 4B
  NETWORKING_REPORT: "/dashboard/networking-report",
  // Phase 5A
  LOYALTY: "/dashboard/loyalty",
  ADMIN_LOYALTY: "/admin/loyalty",
  // Phase 5B
  PROMOTER_DASHBOARD: "/promoter/dashboard",
  PROMOTER_CODES: "/promoter/codes",
  PROMOTER_PAYOUTS: "/promoter/payouts",
  PROMOTER_REFERRALS: "/promoter/referrals",
  ADMIN_PROMOTERS: "/admin/promoters",
  // Phase 5C
  ADMIN_CORPORATE: "/admin/corporate",
  // Phase 6A
  ADMIN_MATCHING: "/admin/matching",
  // Phase 6C
  ADMIN_CHURN: "/admin/churn",
  // Phase 6 QR Generator
  ADMIN_QR_GENERATOR: "/admin/qr-generator",
  // Staff
  STAFF_HOME: "/staff",
  STAFF_CHECKIN: "/staff/checkin",
  STAFF_REGISTER_GUEST: "/staff/register-guest",
} as const;
