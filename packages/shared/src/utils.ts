// ============================================
// AirTrainr Platform - Validation Utilities
// ============================================

import { PASSWORD_MIN_LENGTH, ALLOWED_COUNTRIES, SUPPORTED_SPORTS, MAX_SUB_ACCOUNTS } from './types';

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 * Requirements: 12+ chars, uppercase, lowercase, number, special char
 */
export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < PASSWORD_MIN_LENGTH) {
        errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate phone number (US/CA format)
 */
export function isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?1?\d{10}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

/**
 * Validate age (must be 18+)
 */
export function isAgeValid(dateOfBirth: string): boolean {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        return age - 1 >= 18;
    }
    return age >= 18;
}

/**
 * Validate country is US or CA
 */
export function isAllowedCountry(country: string): boolean {
    return (ALLOWED_COUNTRIES as readonly string[]).includes(country.toUpperCase());
}

/**
 * Validate sport is supported
 */
export function isSupportedSport(sport: string): boolean {
    return (SUPPORTED_SPORTS as readonly string[]).includes(sport);
}

/**
 * Validate ZIP code format
 */
export function isValidZipCode(zipCode: string, country: string = 'US'): boolean {
    if (country === 'US') {
        return /^\d{5}(-\d{4})?$/.test(zipCode);
    }
    if (country === 'CA') {
        return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(zipCode);
    }
    return false;
}

/**
 * Validate hourly rate (reasonable bounds)
 */
export function isValidHourlyRate(rate: number): boolean {
    return rate >= 10 && rate <= 500;
}

/**
 * Validate sub-account count
 */
export function canCreateSubAccount(currentCount: number): boolean {
    return currentCount < MAX_SUB_ACCOUNTS;
}

/**
 * Format currency from cents
 */
export function formatCurrency(amountCents: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(amountCents / 100);
}

/**
 * Format distance
 */
export function formatDistance(miles: number): string {
    if (miles < 1) {
        return `${Math.round(miles * 5280)} ft`;
    }
    return `${miles.toFixed(1)} mi`;
}

/**
 * Calculate platform fee
 */
export function calculatePlatformFee(price: number): number {
    return Math.round(price * 0.03 * 100) / 100;
}

/**
 * Calculate trainer payout
 */
export function calculateTrainerPayout(price: number): number {
    return price - calculatePlatformFee(price);
}

/**
 * Sanitize string (prevent XSS)
 */
export function sanitizeString(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Generate a slug from name
 */
export function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
