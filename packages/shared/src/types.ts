// ============================================
// AirTrainr Platform - Core Type Definitions
// ============================================

// ---- Enums ----

export enum UserRole {
    ATHLETE = 'athlete',
    TRAINER = 'trainer',
    ADMIN = 'admin',
}

export enum SkillLevel {
    BEGINNER = 'beginner',
    INTERMEDIATE = 'intermediate',
    ADVANCED = 'advanced',
    PRO = 'pro',
}

export enum BookingStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    NO_SHOW = 'no_show',
    DISPUTED = 'disputed',
}

export enum PaymentStatus {
    HELD = 'held',
    RELEASED = 'released',
    REFUNDED = 'refunded',
    DISPUTED = 'disputed',
}

export enum VerificationStatus {
    PENDING = 'pending',
    VERIFIED = 'verified',
    REJECTED = 'rejected',
    SUSPENDED = 'suspended',
}

export enum SubscriptionStatus {
    TRIAL = 'trial',
    ACTIVE = 'active',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
}

export enum MediaType {
    PHOTO = 'photo',
    VIDEO = 'video',
    CERTIFICATE = 'certificate',
}

export enum NotificationType {
    NEW_REQUEST_NEARBY = 'NEW_REQUEST_NEARBY',
    BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
    BOOKING_CANCELLED = 'BOOKING_CANCELLED',
    BOOKING_COMPLETED = 'BOOKING_COMPLETED',
    PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
    REVIEW_RECEIVED = 'REVIEW_RECEIVED',
    VERIFICATION_UPDATE = 'VERIFICATION_UPDATE',
    SUBSCRIPTION_EXPIRING = 'SUBSCRIPTION_EXPIRING',
    MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
}

export enum DisputeStatus {
    UNDER_REVIEW = 'under_review',
    RESOLVED = 'resolved',
    ESCALATED = 'escalated',
}

export enum DisputeResolution {
    REFUND_ATHLETE = 'refund_athlete',
    PAYOUT_TRAINER = 'payout_trainer',
    SPLIT = 'split',
}

// ---- Sports ----

export const SUPPORTED_SPORTS = [
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
] as const;

export type Sport = (typeof SUPPORTED_SPORTS)[number];

// ---- Core Interfaces ----

export interface User {
    id: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    phone?: string;
    dateOfBirth?: string;
    sex?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    avatarUrl?: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}

export interface AthleteProfile {
    id: string;
    userId: string;
    skillLevel: SkillLevel;
    sports: Sport[];
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country: 'US' | 'CA';
    latitude?: number;
    longitude?: number;
    travelRadiusMiles: number;
    createdAt: string;
}

export interface SubAccount {
    id: string;
    parentUserId: string;
    profileData: {
        firstName: string;
        lastName: string;
        dateOfBirth?: string;
        sports?: Sport[];
        skillLevel?: SkillLevel;
        ageVerified?: boolean;
        parentVerificationDate?: string;
    };
    maxBookingsPerMonth: number;
    createdAt: string;
}

export interface TrainerProfile {
    id: string;
    userId: string;
    bio?: string;
    headline?: string;
    yearsExperience?: number;
    hourlyRate: number;
    sports: Sport[];
    verificationStatus: VerificationStatus;
    isVerified: boolean;
    subscriptionStatus: SubscriptionStatus;
    subscriptionExpiresAt?: string;
    trialStartedAt?: string;
    completionRate: number;
    reliabilityScore: number;
    latitude?: number;
    longitude?: number;
    addressLine1?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country: 'US' | 'CA';
    travelRadiusMiles: number;
    createdAt: string;
}

export interface TrainerMedia {
    id: string;
    trainerId: string;
    mediaType: MediaType;
    url: string;
    isPrimary: boolean;
    sortOrder: number;
    uploadedAt: string;
}

export interface AvailabilitySlot {
    id: string;
    trainerId: string;
    dayOfWeek: number; // 0-6
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    isRecurring: boolean;
    specificDate?: string;
    isBlocked: boolean;
    timezone: string;
}

export interface Booking {
    id: string;
    athleteId: string;
    trainerId: string;
    subAccountId?: string;
    sport: Sport;
    skillLevelAtBooking?: SkillLevel;
    scheduledAt: string;
    durationMinutes: number;
    latitude?: number;
    longitude?: number;
    address?: string;
    status: BookingStatus;
    athleteNotes?: string;
    trainerNotes?: string;
    price: number;
    platformFee: number;
    totalPaid: number;
    createdAt: string;
    updatedAt: string;
}

export interface PaymentTransaction {
    id: string;
    bookingId: string;
    stripePaymentIntentId?: string;
    stripeTransferId?: string;
    amount: number;
    platformFee: number;
    trainerPayout: number;
    status: PaymentStatus;
    holdUntil?: string;
    releasedAt?: string;
    createdAt: string;
}

export interface Review {
    id: string;
    bookingId: string;
    reviewerId: string;
    revieweeId: string;
    rating: number; // 1-5
    reviewText?: string;
    categories?: {
        punctuality?: number;
        knowledge?: number;
        communication?: number;
        friendliness?: number;
        value?: number;
    };
    isPublic: boolean;
    createdAt: string;
}

export interface Dispute {
    id: string;
    bookingId: string;
    initiatedBy: string;
    reason: string;
    status: DisputeStatus;
    resolution?: DisputeResolution;
    evidenceDeadline: string;
    createdAt: string;
    resolvedAt?: string;
}

export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    read: boolean;
    createdAt: string;
}

// ---- API Types ----

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, string[]>;
    };
    meta?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// ---- Auth Types ----

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole.ATHLETE | UserRole.TRAINER;
    dateOfBirth: string;
    phone?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface JWTPayload {
    userId: string;
    email: string;
    role: UserRole;
    subAccountAccess?: string[];
    iat: number;
    exp: number;
}

// ---- Matching / Search Types ----

export interface MatchFilters {
    sports?: Sport[];
    radius?: number; // in miles
    minRate?: number;
    maxRate?: number;
    skillLevel?: SkillLevel;
    verifiedOnly?: boolean;
    availableAt?: string; // ISO datetime
    latitude?: number;
    longitude?: number;
}

export interface TrainerSearchResult {
    trainer: TrainerProfile & {
        user: Pick<User, 'firstName' | 'lastName' | 'avatarUrl'>;
        primaryMedia?: TrainerMedia;
        averageRating: number;
        totalReviews: number;
    };
    distanceMiles: number;
}

// ---- Booking Types ----

export interface CreateBookingData {
    trainerId: string;
    subAccountId?: string;
    sport: Sport;
    scheduledAt: string;
    durationMinutes: number;
    address?: string;
    latitude?: number;
    longitude?: number;
    athleteNotes?: string;
}

// ---- Payment Types ----

export interface PaymentDetails {
    clientSecret: string;
    amount: number;
    platformFee: number;
    trainerPayout: number;
}

// ---- Constants ----

export const PLATFORM_FEE_PERCENTAGE = 0.03; // 3%
export const MAX_SUB_ACCOUNTS = 6;
export const TRAINER_SUBSCRIPTION_ANNUAL = 250_00; // $250 in cents
export const TRAINER_TRIAL_DAYS = 7;
export const DEFAULT_TRAVEL_RADIUS_MILES = 25;
export const MAX_SEARCH_RADIUS_MILES = 100;
export const HOLD_HOURS_NEW_TRAINER = 48;
export const HOLD_HOURS_ESTABLISHED_TRAINER = 24;
export const ESTABLISHED_TRAINER_THRESHOLD = 3; // completed sessions
export const PASSWORD_MIN_LENGTH = 12;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MINUTES = 15;

// ---- Allowed Countries ----

export const ALLOWED_COUNTRIES = ['US', 'CA'] as const;
export type AllowedCountry = (typeof ALLOWED_COUNTRIES)[number];
