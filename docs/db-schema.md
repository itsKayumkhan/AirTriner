# AirTrainr Database Schema

This file documents the complete schema for the AirTrainr Supabase PostgreSQL database (public schema).

**IMPORTANT:** Update this file whenever you make any database changes — adding/removing tables, adding/removing/renaming columns, changing types or defaults, or adding migrations. Keeping this in sync with the actual DB is required.

---

## Tables

### users

Core user records for all roles (athletes, trainers, admins).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| email | varchar | NO | - |
| password_hash | varchar | NO | - |
| role | USER-DEFINED (role enum) | NO | - |
| first_name | varchar | NO | - |
| last_name | varchar | NO | - |
| phone | varchar | YES | - |
| date_of_birth | date | YES | - |
| sex | varchar | YES | - |
| email_verified | boolean | YES | false |
| phone_verified | boolean | YES | false |
| avatar_url | text | YES | - |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| deleted_at | timestamptz | YES | - |
| last_login_at | timestamptz | YES | - |
| is_approved | boolean | YES | false |
| is_suspended | boolean | NO | false |

> Note: `is_suspended` was added 2026-03-28 for the athlete suspend/activate feature.

---

### athlete_profiles

Extended profile data for users with the `athlete` role.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO | - |
| skill_level | USER-DEFINED (skill_level enum) | YES | 'beginner' |
| sports | ARRAY (text[]) | YES | '{}' |
| address_line1 | text | YES | - |
| address_line2 | text | YES | - |
| city | varchar | YES | - |
| state | varchar | YES | - |
| zip_code | varchar | YES | - |
| country | varchar | YES | 'US' |
| latitude | float8 | YES | - |
| longitude | float8 | YES | - |
| travel_radius_miles | int | YES | 25 |
| created_at | timestamptz | YES | now() |
| preferredTrainingTimes | ARRAY | YES | - |
| trainingPreferences | ARRAY | YES | - |

---

### trainer_profiles

Extended profile data for users with the `trainer` role.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO | - |
| bio | text | YES | - |
| headline | varchar | YES | - |
| years_experience | int | YES | 0 |
| hourly_rate | numeric | YES | 50.00 |
| sports | ARRAY (text[]) | YES | '{}' |
| certifications | jsonb | YES | '[]' |
| verification_status | USER-DEFINED (verification_status enum) | YES | 'pending' |
| is_verified | boolean | YES | false |
| subscription_status | USER-DEFINED (subscription_status enum) | YES | 'trial' |
| subscription_expires_at | timestamptz | YES | - |
| trial_started_at | timestamptz | YES | now() |
| stripe_account_id | varchar | YES | - |
| completion_rate | numeric | YES | 100.00 |
| reliability_score | numeric | YES | 100.00 |
| total_sessions | int | YES | 0 |
| address_line1 | text | YES | - |
| city | varchar | YES | - |
| state | varchar | YES | - |
| zip_code | varchar | YES | - |
| country | varchar | YES | 'US' |
| latitude | float8 | YES | - |
| longitude | float8 | YES | - |
| travel_radius_miles | int | YES | 25 |
| created_at | timestamptz | YES | now() |
| trainingTypes | ARRAY | YES | - |
| preferredTrainingTimes | ARRAY | YES | - |
| average_rating | numeric | YES | 0 |
| total_reviews | int | YES | 0 |
| target_skill_levels | ARRAY | YES | - |
| profile_views | int | NO | 0 |
| is_sponsored | boolean | NO | false |
| is_founding_50 | boolean | NO | false |
| founding_50_granted_at | timestamptz | YES | - |

---

### bookings

Training session bookings between athletes and trainers.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| athlete_id | uuid | NO | - |
| trainer_id | uuid | NO | - |
| sub_account_id | uuid | YES | - |
| sport | varchar | NO | - |
| skill_level_at_booking | USER-DEFINED (skill_level enum) | YES | - |
| scheduled_at | timestamptz | NO | - |
| duration_minutes | int | NO | 60 |
| latitude | float8 | YES | - |
| longitude | float8 | YES | - |
| address | text | YES | - |
| status | USER-DEFINED (booking_status enum) | YES | 'pending' |
| athlete_notes | text | YES | - |
| trainer_notes | text | YES | - |
| price | numeric | NO | - |
| platform_fee | numeric | NO | - |
| total_paid | numeric | NO | - |
| status_history | jsonb | YES | '[]' |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| cancelled_at | timestamptz | YES | - |
| cancellation_reason | text | YES | - |

---

### disputes

Disputes raised against a booking by either party.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| booking_id | uuid | NO | - |
| initiated_by | uuid | NO | - |
| reason | text | NO | - |
| evidence | jsonb | YES | '[]' |
| status | USER-DEFINED (dispute_status enum) | YES | 'under_review' |
| resolution | USER-DEFINED | YES | - |
| admin_notes | text | YES | - |
| evidence_deadline | timestamptz | NO | now() + interval '72 hours' |
| created_at | timestamptz | YES | now() |
| resolved_at | timestamptz | YES | - |

---

### payment_transactions

Payment records tied to a booking, tracking Stripe intents and payouts.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| booking_id | uuid | NO | - |
| stripe_payment_intent_id | varchar | YES | - |
| stripe_transfer_id | varchar | YES | - |
| amount | numeric | NO | - |
| platform_fee | numeric | NO | - |
| trainer_payout | numeric | NO | - |
| status | USER-DEFINED (payment_status enum) | YES | 'held' |
| hold_until | timestamptz | YES | - |
| released_at | timestamptz | YES | - |
| created_at | timestamptz | YES | now() |

---

### sports

Lookup table of sports supported by the platform.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| name | text | NO | - |
| slug | text | NO | - |
| icon | text | YES | - |
| is_active | boolean | YES | true |
| created_at | timestamptz | NO | now() |
| image_url | text | YES | - |

---

### platform_settings

Global platform configuration. Single-row table with a fixed id.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | '00000000-0000-0000-0000-000000000001' |
| platform_fee_percentage | numeric | YES | 3.0 |
| max_booking_distance | numeric | YES | 50.0 |
| auto_approve_trainers | boolean | YES | false |
| require_trainer_verification | boolean | YES | true |
| cancellation_policy_hours | int | YES | 24 |
| dispute_resolution_days | int | YES | 7 |
| support_email | text | YES | 'support@airtrainer.com' |
| maintenance_mode | boolean | YES | false |
| updated_at | timestamptz | YES | now() |

---

### messages

In-app messages scoped to a booking conversation.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| booking_id | uuid | NO | - |
| sender_id | uuid | NO | - |
| content | text | NO | - |
| read_at | timestamptz | YES | - |
| created_at | timestamptz | YES | now() |

---

### notifications

In-app notifications delivered to a specific user.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO | - |
| type | USER-DEFINED (notification_type enum) | NO | - |
| title | varchar | NO | - |
| body | text | NO | - |
| data | jsonb | YES | '{}' |
| read | boolean | YES | false |
| created_at | timestamptz | YES | now() |

---

### reviews

Ratings and written reviews left after a completed booking.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| booking_id | uuid | NO | - |
| reviewer_id | uuid | NO | - |
| reviewee_id | uuid | NO | - |
| rating | int | NO | - |
| review_text | text | YES | - |
| categories | jsonb | YES | '{}' |
| is_public | boolean | YES | true |
| created_at | timestamptz | YES | now() |

---

### availability_slots

Trainer availability schedule, supporting both recurring and one-off slots.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| trainer_id | uuid | NO | - |
| day_of_week | int | YES | - |
| start_time | varchar | NO | - |
| end_time | varchar | NO | - |
| is_recurring | boolean | YES | true |
| specific_date | date | YES | - |
| is_blocked | boolean | YES | false |
| timezone | varchar | YES | 'America/New_York' |
| created_at | timestamptz | YES | now() |

---

### sub_accounts

Child profiles managed under a parent user account (e.g., a parent managing a child athlete).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| parent_user_id | uuid | NO | - |
| profile_data | jsonb | NO | '{}' |
| max_bookings_per_month | int | YES | 10 |
| is_active | boolean | YES | true |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### trainer_media

Photos and videos uploaded to a trainer's profile.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| trainer_id | uuid | NO | - |
| media_type | USER-DEFINED (media_type enum) | NO | - |
| url | text | NO | - |
| thumbnail_url | text | YES | - |
| title | varchar | YES | - |
| description | text | YES | - |
| is_primary | boolean | YES | false |
| sort_order | int | YES | 0 |
| uploaded_at | timestamptz | YES | now() |

---

### training_offers

Direct training offers sent from a trainer to an athlete.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| trainer_id | uuid | NO | - |
| athlete_id | uuid | NO | - |
| status | USER-DEFINED (OfferStatus enum) | NO | 'pending' |
| message | text | YES | - |
| price | numeric | NO | - |
| session_length_min | int | NO | 60 |
| proposed_dates | jsonb | YES | - |
| sport | varchar | YES | - |
| created_at | timestamp | NO | CURRENT_TIMESTAMP |
| updated_at | timestamp | NO | CURRENT_TIMESTAMP |

---

### reschedule_requests

Reschedule requests raised against an existing booking.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| booking_id | uuid | NO | - |
| initiated_by | uuid | NO | - |
| proposed_time | timestamptz | NO | - |
| status | text | NO | 'pending' |
| reason | text | YES | - |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

---

### ad_banners

Promotional banners displayed across the platform.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| title | varchar | NO | - |
| image_url | varchar | NO | - |
| link_url | varchar | NO | - |
| placement | ARRAY | NO | ['search_top'] |
| is_active | boolean | NO | true |
| impressions | int | NO | 0 |
| clicks | int | NO | 0 |
| start_date | timestamptz | YES | now() |
| end_date | timestamptz | YES | - |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### waitlist

Email waitlist for pre-launch sign-ups.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| email | text | NO | - |
| created_at | timestamptz | YES | now() |

---

### push_tokens

Device push notification tokens per user.

| Column | Type | Nullable |
|--------|------|----------|
| user_id | uuid | NO |
| token | text | NO |
| platform | text | NO |
| is_active | boolean | YES |
| created_at | timestamptz | YES |

---

### refresh_tokens

JWT refresh tokens used for session management.

| Column | Type | Nullable |
|--------|------|----------|
| user_id | uuid | NO |
| token_hash | text | NO |
| device_info | text | YES |
| expires_at | timestamptz | NO |
| revoked_at | timestamptz | YES |
| created_at | timestamptz | YES |

---

## Enums

| Enum | Values |
|------|--------|
| `role` | athlete, trainer, admin |
| `skill_level` | beginner, intermediate, advanced, pro |
| `booking_status` | pending, confirmed, completed, cancelled |
| `dispute_status` | under_review, escalated, resolved |
| `payment_status` | held, released, refunded |
| `verification_status` | pending, verified, declined |
| `subscription_status` | trial, active, expired, cancelled |
| `OfferStatus` | pending, accepted, rejected, expired |

---

## Migration History

| Date | Description |
|------|-------------|
| 2026-03-28 | Added `is_suspended` boolean DEFAULT false to `users` table (athlete suspend/activate feature) |
