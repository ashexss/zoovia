import { Timestamp } from '@angular/fire/firestore';

// User roles
export type UserRole = 'admin' | 'veterinarian' | 'assistant' | 'client' | 'groomer';

// User interface
export interface User {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    veterinaryId?: string;
    branchIds?: string[];
    phone?: string;
    avatar?: string;
    createdAt: Timestamp;
    lastLogin: Timestamp;
}

// Address interface
export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}

// Business shift for a single time period
export interface BusinessShift {
    open: string;   // Format: "HH:mm" (24h) - e.g., "09:00"
    close: string;  // Format: "HH:mm" (24h) - e.g., "13:00"
}

// Schedule for a single day (can have multiple shifts)
export interface DaySchedule {
    shifts: BusinessShift[];  // Array of shifts - supports split hours
}

// Business hours interface (only includes open days)
export interface BusinessHours {
    monday?: DaySchedule;
    tuesday?: DaySchedule;
    wednesday?: DaySchedule;
    thursday?: DaySchedule;
    friday?: DaySchedule;
    saturday?: DaySchedule;
    sunday?: DaySchedule;
}

// Closed date (for specific holidays/feriados)
export interface ClosedDate {
    date: string;      // Format: "YYYY-MM-DD" - e.g., "2026-12-25"
    reason: string;    // e.g., "Navidad", "Feriado Nacional"
}

// Vacation period
export interface VacationPeriod {
    startDate: string;  // Format: "YYYY-MM-DD"
    endDate: string;    // Format: "YYYY-MM-DD"
    reason: string;     // e.g., "Vacaciones de verano"
}

// Veterinary interface
import { Subscription, BusinessType } from './subscription';

export * from './subscription';

export interface Veterinary {
    id: string;
    name: string;
    address: Address;
    phone: string;
    email: string;
    logo?: string;
    brandColor?: string;
    businessHours?: BusinessHours;
    closedDates?: ClosedDate[];
    vacationPeriods?: VacationPeriod[];

    // Subscription
    businessType: BusinessType;
    subscription: Subscription;

    // Appointment configuration
    appointmentSettings?: {
        mode: 'walk_in' | 'scheduled' | 'both';
        defaultDuration: number;
        slotInterval: number;
        maxAdvanceDays: number;
    };

    // Loyalty program configuration
    loyaltyProgram?: LoyaltyProgram;

    features?: {
        maxUsers: number;
        maxPets: number;
        maxStorage: number;
        customBranding: boolean;
        apiAccess: boolean;
    };

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Branch interface
export interface Branch {
    id: string;
    veterinaryId: string;
    name: string;
    address: string;
    phone: string;
    isMain: boolean;
    createdAt: Timestamp;
}

// Loyalty tier type
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// Client interface
export interface Client {
    id: string;
    veterinaryId: string;
    branchId: string;
    userId?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    whatsapp?: string;
    address: string;
    city: string;
    identificationNumber: string;
    notificationPreferences: {
        email: boolean;
        sms: boolean;
        whatsapp: boolean;
    };
    // Loyalty
    loyaltyPoints: number;           // Current balance (was optional, now explicit)
    loyalty?: {
        totalEarned: number;         // All-time accumulated
        totalRedeemed: number;       // All-time redeemed
        tier: LoyaltyTier;
        enrolledAt: Timestamp;
        portalPin?: string;          // Future client portal 4-digit PIN
    };
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Loyalty transaction types
export type LoyaltyTransactionType =
    | 'earned_visit'       // Points from a completed appointment
    | 'earned_purchase'    // Points from product purchase
    | 'earned_grooming'    // Points from grooming service
    | 'redeemed'           // Redemption (discount, etc.)
    | 'adjusted'           // Manual admin adjustment
    | 'expired';           // Expired points (if enabled)

// Loyalty transaction
export interface LoyaltyTransaction {
    id: string;
    veterinaryId: string;
    clientId: string;
    type: LoyaltyTransactionType;
    points: number;                  // Positive = earned, Negative = spent/expired
    balanceAfter: number;            // Balance after this transaction
    referenceType?: 'appointment' | 'purchase' | 'redemption';
    referenceId?: string;
    description: string;
    createdBy: string;
    createdAt: Timestamp;
}

// Loyalty program configuration (stored in Veterinary)
export interface LoyaltyProgram {
    enabled: boolean;
    pointsPerVisit: number;          // e.g. 10
    pointsPerGrooming: number;       // e.g. 15
    pointsPerPurchasePeso: number;   // e.g. 1 point per $1
    redemptionRate: number;          // e.g. 100 points = $1
    tiers: {
        bronze: number;   // 0 (default)
        silver: number;   // e.g. 200
        gold: number;     // e.g. 500
        platinum: number; // e.g. 1000
    };
}

// Pet species and gender types
export type PetSpecies = 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
export type PetGender = 'male' | 'female';

// Pet interface
export interface Pet {
    id: string;
    veterinaryId: string;
    clientId: string;
    name: string;
    species: PetSpecies;
    breed: string;
    gender: PetGender;
    birthDate: Timestamp;
    weight: number;
    color: string;
    microchipNumber?: string;
    photo?: string;
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Medical record types
export type MedicalRecordType = 'consultation' | 'vaccination' | 'surgery' | 'treatment' | 'checkup';

// Prescription interface
export interface Prescription {
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    price?: number;
}

// Medical record interface
export interface MedicalRecord {
    id: string;
    veterinaryId: string;
    petId: string;
    clientId: string;
    date: Timestamp;
    type: MedicalRecordType;
    veterinarianId: string;
    diagnosis: string;
    treatment: string;
    notes: string;
    prescriptions: Prescription[];
    attachments?: string[];
    createdAt: Timestamp;
}

// Vaccination interface
export interface Vaccination {
    id: string;
    veterinaryId: string;
    petId: string;
    clientId: string;
    vaccineName: string;
    applicationDate: Timestamp;
    nextDueDate: Timestamp;
    veterinarianId: string;
    batchNumber?: string;
    notes?: string;
    reminderSent: boolean;
    createdAt: Timestamp;
}

// Reminder types and status
export type ReminderType = 'vaccination' | 'deworming' | 'treatment' | 'checkup' | 'grooming';
export type ReminderStatus = 'pending' | 'sent' | 'completed' | 'cancelled';
export type NotificationChannel = 'email' | 'sms' | 'whatsapp';

// Reminder interface
export interface Reminder {
    id: string;
    veterinaryId: string;
    clientId: string;
    petId: string;
    type: ReminderType;
    dueDate: Timestamp;
    message: string;
    status: ReminderStatus;
    notificationChannels: NotificationChannel[];
    sentAt?: Timestamp;
    createdAt: Timestamp;
}
