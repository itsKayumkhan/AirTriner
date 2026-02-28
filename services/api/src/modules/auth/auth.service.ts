// ============================================
// AirTrainr API - Auth Service
// ============================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config';
import {
    UnauthorizedError,
    BadRequestError,
    ConflictError,
    GeoRestrictedError,
    AgeVerificationError,
} from '../../common/errors';
import { logger } from '../../common/logger';
import {
    UserRole,
    JWTPayload,
    AuthTokens,
    RegisterData,
    LoginCredentials,
} from '@airtrainr/shared';
import { isValidPassword, isValidEmail, isAgeValid } from '@airtrainr/shared';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

export class AuthService {
    /**
     * Register a new user
     */
    async register(data: RegisterData): Promise<AuthTokens> {
        // Validate email
        if (!isValidEmail(data.email)) {
            throw new BadRequestError('Invalid email format');
        }

        // Validate password
        const passwordValidation = isValidPassword(data.password);
        if (!passwordValidation.valid) {
            throw new BadRequestError(passwordValidation.errors.join('. '));
        }

        // Validate age (must be 18+)
        if (!isAgeValid(data.dateOfBirth)) {
            throw new AgeVerificationError('You must be at least 18 years old to register');
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email.toLowerCase() },
        });
        if (existingUser) {
            throw new ConflictError('An account with this email already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: data.email.toLowerCase(),
                passwordHash,
                role: data.role as any,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                dateOfBirth: new Date(data.dateOfBirth),
            },
        });

        // Create role-specific profile
        if (data.role === UserRole.ATHLETE) {
            await prisma.athleteProfile.create({
                data: {
                    userId: user.id,
                    sports: [],
                },
            });
        } else if (data.role === UserRole.TRAINER) {
            await prisma.trainerProfile.create({
                data: {
                    userId: user.id,
                    sports: [],
                    trialStartedAt: new Date(),
                },
            });
        }

        // Create age verification record
        await prisma.ageVerification.create({
            data: {
                userId: user.id,
                verificationMethod: 'date_of_birth',
                verifiedAt: new Date(),
                status: 'verified',
            },
        });

        logger.info(`User registered: ${user.id} (${user.role})`);

        // Generate tokens
        return this.generateTokens(user);
    }

    /**
     * Login user
     */
    async login(credentials: LoginCredentials): Promise<AuthTokens> {
        const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase() },
        });

        if (!user || user.deletedAt) {
            throw new UnauthorizedError('Invalid email or password');
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedError('Invalid email or password');
        }

        logger.info(`User logged in: ${user.id}`);

        return this.generateTokens(user);
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
        // Find the refresh token in DB
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });

        if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
            throw new UnauthorizedError('Invalid or expired refresh token');
        }

        // Verify JWT
        try {
            jwt.verify(refreshToken, config.jwtRefreshSecret);
        } catch {
            // Revoke the token if verification fails
            await prisma.refreshToken.update({
                where: { id: storedToken.id },
                data: { revokedAt: new Date() },
            });
            throw new UnauthorizedError('Invalid refresh token');
        }

        // Revoke old refresh token (token rotation)
        await prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { revokedAt: new Date() },
        });

        logger.info(`Token refreshed for user: ${storedToken.user.id}`);

        // Generate new tokens
        return this.generateTokens(storedToken.user);
    }

    /**
     * Logout - revoke refresh token
     */
    async logout(refreshToken: string): Promise<void> {
        await prisma.refreshToken.updateMany({
            where: { token: refreshToken },
            data: { revokedAt: new Date() },
        });
    }

    /**
     * Logout from all devices - revoke all refresh tokens
     */
    async logoutAll(userId: string): Promise<void> {
        await prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        logger.info(`All tokens revoked for user: ${userId}`);
    }

    /**
     * Get current user profile
     */
    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                athleteProfile: true,
                trainerProfile: {
                    include: {
                        media: true,
                        availabilitySlots: true,
                    },
                },
                ageVerification: true,
                subAccounts: true,
            },
        });

        if (!user || user.deletedAt) {
            throw new UnauthorizedError('User not found');
        }

        // Remove sensitive fields
        const { passwordHash, ...safeUser } = user;
        return safeUser;
    }

    // ---- Private Methods ----

    private async generateTokens(user: {
        id: string;
        email: string;
        role: any;
    }): Promise<AuthTokens> {
        // Get sub-accounts for JWT payload
        const subAccounts = await prisma.subAccount.findMany({
            where: { parentUserId: user.id },
            select: { id: true },
        });

        const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
            userId: user.id,
            email: user.email,
            role: user.role as UserRole,
            subAccountAccess: subAccounts.map((sa) => sa.id),
        };

        // Generate access token (15 min)
        const accessToken = jwt.sign(payload, config.jwtAccessSecret, {
            expiresIn: config.jwtAccessExpiry,
        });

        // Generate refresh token (7 days)
        const refreshToken = jwt.sign(
            { userId: user.id, tokenId: uuidv4() },
            config.jwtRefreshSecret,
            { expiresIn: config.jwtRefreshExpiry }
        );

        // Store refresh token in DB
        await prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: 900, // 15 minutes in seconds
        };
    }
}

export const authService = new AuthService();
