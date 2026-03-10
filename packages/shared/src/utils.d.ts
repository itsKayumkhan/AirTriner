/**
 * Validate email format
 */
export declare function isValidEmail(email: string): boolean;
/**
 * Validate password strength
 * Requirements: 12+ chars, uppercase, lowercase, number, special char
 */
export declare function isValidPassword(password: string): {
    valid: boolean;
    errors: string[];
};
/**
 * Validate phone number (US/CA format)
 */
export declare function isValidPhone(phone: string): boolean;
/**
 * Validate age (must be 18+)
 */
export declare function isAgeValid(dateOfBirth: string): boolean;
/**
 * Validate country is US or CA
 */
export declare function isAllowedCountry(country: string): boolean;
/**
 * Validate sport is supported
 */
export declare function isSupportedSport(sport: string): boolean;
/**
 * Validate ZIP code format
 */
export declare function isValidZipCode(zipCode: string, country?: string): boolean;
/**
 * Validate hourly rate (reasonable bounds)
 */
export declare function isValidHourlyRate(rate: number): boolean;
/**
 * Validate sub-account count
 */
export declare function canCreateSubAccount(currentCount: number): boolean;
/**
 * Format currency from cents
 */
export declare function formatCurrency(amountCents: number, currency?: string): string;
/**
 * Format distance
 */
export declare function formatDistance(miles: number): string;
/**
 * Calculate platform fee
 */
export declare function calculatePlatformFee(price: number): number;
/**
 * Calculate trainer payout
 */
export declare function calculateTrainerPayout(price: number): number;
/**
 * Sanitize string (prevent XSS)
 */
export declare function sanitizeString(str: string): string;
/**
 * Generate a slug from name
 */
export declare function generateSlug(name: string): string;
//# sourceMappingURL=utils.d.ts.map