export enum BusinessType {
    VETERINARY = 'veterinary',      // Veterinaria completa
    GROOMING = 'grooming',           // Peluquería independiente
    HYBRID = 'hybrid'                // Veterinaria + Peluquería
}

export type SubscriptionPlan = 'base_vet' | 'base_grooming' | 'complete_vet' | 'complete_grooming' | 'custom';

export interface SubscriptionModules {
    // Core modules (always included based on business type)
    clients: boolean;           // Always true
    pets: boolean;              // Always true
    medicalRecords: boolean;    // True for veterinary, false for grooming-only

    // Optional modules
    appointments: boolean;      // Módulo de turnos
    grooming: boolean;          // Módulo de peluquería
    inventory: boolean;         // Módulo de inventario
}

export interface SubscriptionFeatures {
    maxUsers: number;           // Based on plan
    maxPets: number;            // Based on plan (-1 = unlimited)
    maxStorage: number;         // In MB
    customBranding: boolean;
    apiAccess: boolean;
}

export interface Subscription {
    // Plan information
    plan: SubscriptionPlan;
    businessType: BusinessType;

    // Active modules
    modules: SubscriptionModules;

    // Billing
    billingCycle: 'monthly' | 'yearly';
    monthlyPrice: number;         // Calculated based on plan + modules
    currency: 'USD' | 'ARS';

    // Status
    status: 'active' | 'trial' | 'suspended' | 'cancelled';
    trialEndsAt?: any; // Firestore Timestamp
    currentPeriodStart: any; // Firestore Timestamp
    currentPeriodEnd: any; // Firestore Timestamp
    nextBillingDate: any; // Firestore Timestamp

    // Payment
    paymentMethod?: 'credit_card' | 'bank_transfer' | 'mercadopago';
    lastPaymentDate?: any; // Firestore Timestamp
    lastPaymentAmount?: number;
}
