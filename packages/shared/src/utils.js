"use strict";
// ============================================
// AirTrainr Platform - Validation Utilities
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidEmail = isValidEmail;
exports.isValidPassword = isValidPassword;
exports.isValidPhone = isValidPhone;
exports.isAgeValid = isAgeValid;
exports.isAllowedCountry = isAllowedCountry;
exports.isSupportedSport = isSupportedSport;
exports.isValidZipCode = isValidZipCode;
exports.isValidHourlyRate = isValidHourlyRate;
exports.canCreateSubAccount = canCreateSubAccount;
exports.formatCurrency = formatCurrency;
exports.formatDistance = formatDistance;
exports.calculatePlatformFee = calculatePlatformFee;
exports.calculateTrainerPayout = calculateTrainerPayout;
exports.sanitizeString = sanitizeString;
exports.generateSlug = generateSlug;
const types_1 = require("./types");
/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * Validate password strength
 * Requirements: 12+ chars, uppercase, lowercase, number, special char
 */
function isValidPassword(password) {
    const errors = [];
    if (password.length < types_1.PASSWORD_MIN_LENGTH) {
        errors.push(`Password must be at least ${types_1.PASSWORD_MIN_LENGTH} characters long`);
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
function isValidPhone(phone) {
    const phoneRegex = /^\+?1?\d{10}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}
/**
 * Validate age (must be 18+)
 */
function isAgeValid(dateOfBirth) {
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
function isAllowedCountry(country) {
    return types_1.ALLOWED_COUNTRIES.includes(country.toUpperCase());
}
/**
 * Validate sport is supported
 */
function isSupportedSport(sport) {
    return types_1.SUPPORTED_SPORTS.includes(sport);
}
/**
 * Validate ZIP code format
 */
function isValidZipCode(zipCode, country = 'US') {
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
function isValidHourlyRate(rate) {
    return rate >= 10 && rate <= 500;
}
/**
 * Validate sub-account count
 */
function canCreateSubAccount(currentCount) {
    return currentCount < types_1.MAX_SUB_ACCOUNTS;
}
/**
 * Format currency from cents
 */
function formatCurrency(amountCents, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(amountCents / 100);
}
/**
 * Format distance
 */
function formatDistance(miles) {
    if (miles < 1) {
        return `${Math.round(miles * 5280)} ft`;
    }
    return `${miles.toFixed(1)} mi`;
}
/**
 * Calculate platform fee
 */
function calculatePlatformFee(price) {
    return Math.round(price * 0.03 * 100) / 100;
}
/**
 * Calculate trainer payout
 */
function calculateTrainerPayout(price) {
    return price - calculatePlatformFee(price);
}
/**
 * Sanitize string (prevent XSS)
 */
function sanitizeString(str) {
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
function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
//# sourceMappingURL=utils.js.map