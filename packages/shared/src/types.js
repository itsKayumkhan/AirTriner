"use strict";
// ============================================
// AirTrainr Platform - Core Type Definitions
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_COUNTRIES = exports.LOGIN_LOCKOUT_MINUTES = exports.MAX_LOGIN_ATTEMPTS = exports.PASSWORD_MIN_LENGTH = exports.ESTABLISHED_TRAINER_THRESHOLD = exports.HOLD_HOURS_ESTABLISHED_TRAINER = exports.HOLD_HOURS_NEW_TRAINER = exports.MAX_SEARCH_RADIUS_MILES = exports.DEFAULT_TRAVEL_RADIUS_MILES = exports.TRAINER_TRIAL_DAYS = exports.TRAINER_SUBSCRIPTION_ANNUAL = exports.MAX_SUB_ACCOUNTS = exports.PLATFORM_FEE_PERCENTAGE = exports.SUPPORTED_SPORTS = exports.DisputeResolution = exports.DisputeStatus = exports.NotificationType = exports.MediaType = exports.SubscriptionStatus = exports.VerificationStatus = exports.PaymentStatus = exports.BookingStatus = exports.SkillLevel = exports.UserRole = void 0;
// ---- Enums ----
var UserRole;
(function (UserRole) {
    UserRole["ATHLETE"] = "athlete";
    UserRole["TRAINER"] = "trainer";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var SkillLevel;
(function (SkillLevel) {
    SkillLevel["BEGINNER"] = "beginner";
    SkillLevel["INTERMEDIATE"] = "intermediate";
    SkillLevel["ADVANCED"] = "advanced";
    SkillLevel["PRO"] = "pro";
})(SkillLevel || (exports.SkillLevel = SkillLevel = {}));
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["PENDING"] = "pending";
    BookingStatus["CONFIRMED"] = "confirmed";
    BookingStatus["REJECTED"] = "rejected";
    BookingStatus["COMPLETED"] = "completed";
    BookingStatus["CANCELLED"] = "cancelled";
    BookingStatus["NO_SHOW"] = "no_show";
    BookingStatus["DISPUTED"] = "disputed";
    BookingStatus["RESCHEDULE_REQUESTED"] = "reschedule_requested";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["HELD"] = "held";
    PaymentStatus["RELEASED"] = "released";
    PaymentStatus["REFUNDED"] = "refunded";
    PaymentStatus["DISPUTED"] = "disputed";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["PENDING"] = "pending";
    VerificationStatus["VERIFIED"] = "verified";
    VerificationStatus["REJECTED"] = "rejected";
    VerificationStatus["SUSPENDED"] = "suspended";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["TRIAL"] = "trial";
    SubscriptionStatus["ACTIVE"] = "active";
    SubscriptionStatus["EXPIRED"] = "expired";
    SubscriptionStatus["CANCELLED"] = "cancelled";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var MediaType;
(function (MediaType) {
    MediaType["PHOTO"] = "photo";
    MediaType["VIDEO"] = "video";
    MediaType["CERTIFICATE"] = "certificate";
})(MediaType || (exports.MediaType = MediaType = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["NEW_REQUEST_NEARBY"] = "NEW_REQUEST_NEARBY";
    NotificationType["BOOKING_CONFIRMED"] = "BOOKING_CONFIRMED";
    NotificationType["BOOKING_CANCELLED"] = "BOOKING_CANCELLED";
    NotificationType["BOOKING_COMPLETED"] = "BOOKING_COMPLETED";
    NotificationType["PAYMENT_RECEIVED"] = "PAYMENT_RECEIVED";
    NotificationType["REVIEW_RECEIVED"] = "REVIEW_RECEIVED";
    NotificationType["VERIFICATION_UPDATE"] = "VERIFICATION_UPDATE";
    NotificationType["SUBSCRIPTION_EXPIRING"] = "SUBSCRIPTION_EXPIRING";
    NotificationType["MESSAGE_RECEIVED"] = "MESSAGE_RECEIVED";
    NotificationType["UPCOMING_SESSION_REMINDER_24H"] = "UPCOMING_SESSION_REMINDER_24H";
    NotificationType["UPCOMING_SESSION_REMINDER_1H"] = "UPCOMING_SESSION_REMINDER_1H";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var DisputeStatus;
(function (DisputeStatus) {
    DisputeStatus["UNDER_REVIEW"] = "under_review";
    DisputeStatus["RESOLVED"] = "resolved";
    DisputeStatus["ESCALATED"] = "escalated";
})(DisputeStatus || (exports.DisputeStatus = DisputeStatus = {}));
var DisputeResolution;
(function (DisputeResolution) {
    DisputeResolution["REFUND_ATHLETE"] = "refund_athlete";
    DisputeResolution["PAYOUT_TRAINER"] = "payout_trainer";
    DisputeResolution["SPLIT"] = "split";
})(DisputeResolution || (exports.DisputeResolution = DisputeResolution = {}));
// ---- Sports ----
exports.SUPPORTED_SPORTS = [
    'hockey',
    'baseball',
    'basketball',
    'football',
    'soccer',
    'tennis',
    'golf',
    'swimming',
    'track_and_field',
    'volleyball',
    'lacrosse',
    'wrestling',
    'boxing',
    'martial_arts',
    'gymnastics',
    'skiing',
    'snowboarding',
    'figure_skating',
    'softball',
    'rugby',
];
// ---- Constants ----
exports.PLATFORM_FEE_PERCENTAGE = 0.03; // 3%
exports.MAX_SUB_ACCOUNTS = 6;
exports.TRAINER_SUBSCRIPTION_ANNUAL = 250_00; // $250 in cents
exports.TRAINER_TRIAL_DAYS = 7;
exports.DEFAULT_TRAVEL_RADIUS_MILES = 25;
exports.MAX_SEARCH_RADIUS_MILES = 100;
exports.HOLD_HOURS_NEW_TRAINER = 48;
exports.HOLD_HOURS_ESTABLISHED_TRAINER = 24;
exports.ESTABLISHED_TRAINER_THRESHOLD = 3; // completed sessions
exports.PASSWORD_MIN_LENGTH = 12;
exports.MAX_LOGIN_ATTEMPTS = 5;
exports.LOGIN_LOCKOUT_MINUTES = 15;
// ---- Allowed Countries ----
exports.ALLOWED_COUNTRIES = ['US', 'CA'];
//# sourceMappingURL=types.js.map