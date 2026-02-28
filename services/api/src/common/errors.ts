// ============================================
// AirTrainr API - Custom Error Classes
// ============================================

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;
    public readonly details?: Record<string, string[]>;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = 'INTERNAL_ERROR',
        isOperational: boolean = true,
        details?: Record<string, string[]>
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export class BadRequestError extends AppError {
    constructor(message: string = 'Bad request', details?: Record<string, string[]>) {
        super(message, 400, 'BAD_REQUEST', true, details);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

export class ConflictError extends AppError {
    constructor(message: string = 'Resource already exists') {
        super(message, 409, 'CONFLICT');
    }
}

export class TooManyRequestsError extends AppError {
    constructor(message: string = 'Too many requests') {
        super(message, 429, 'TOO_MANY_REQUESTS');
    }
}

export class GeoRestrictedError extends AppError {
    constructor(message: string = 'Service not available in your region') {
        super(message, 403, 'GEO_RESTRICTED');
    }
}

export class AgeVerificationError extends AppError {
    constructor(message: string = 'Age verification required') {
        super(message, 403, 'AGE_VERIFICATION_REQUIRED');
    }
}

export class PaymentError extends AppError {
    constructor(message: string = 'Payment processing error') {
        super(message, 402, 'PAYMENT_ERROR');
    }
}

export class ValidationError extends AppError {
    constructor(errors: Record<string, string[]>) {
        super('Validation failed', 422, 'VALIDATION_ERROR', true, errors);
    }
}
