export enum BusinessType {
    VETERINARY = 'veterinary',      // Veterinaria completa
    GROOMING = 'grooming',           // Peluquería independiente
    HYBRID = 'hybrid'                // Veterinaria + Peluquería
}

/**
 * Planes disponibles:
 * - 'zoovia'          → Plan único todo incluido (clientes, mascotas, historiales, turnos, fidelización)
 * - 'base_vet'        → Solo core veterinaria (legacy)
 * - 'base_grooming'   → Solo core peluquería (legacy)
 * - 'complete_vet'    → Bundle veterinaria completo (legacy)
 * - 'complete_grooming' → Bundle peluquería completo (legacy)
 * - 'custom'          → Módulos a medida
 */
export type SubscriptionPlan =
    | 'zoovia_plan'
    | 'base_vet'
    | 'base_grooming'
    | 'complete_vet'
    | 'complete_grooming'
    | 'custom';

export interface SubscriptionModules {
    // Core modules (always included)
    clients: boolean;
    pets: boolean;
    medicalRecords: boolean;

    // Incluidos en Plan Zoovia
    appointments: boolean;      // Módulo de turnos y agenda
    loyalty: boolean;           // Módulo de fidelización (puntos y niveles)

    // Add-ons futuros
    grooming: boolean;          // Módulo de peluquería
    inventory: boolean;         // Módulo de inventario
}

export interface SubscriptionFeatures {
    maxUsers: number;
    maxPets: number;            // -1 = unlimited
    maxStorage: number;         // In MB
    customBranding: boolean;
    apiAccess: boolean;
}

export interface Subscription {
    // Plan
    plan: SubscriptionPlan;
    businessType: BusinessType;

    // Módulos activos
    modules: SubscriptionModules;

    // Facturación
    billingCycle: 'monthly' | 'yearly';
    monthlyPrice: number;
    currency: 'USD' | 'ARS';
    billingContactEmail?: string; // Email de contacto para facturación (editable por el vet)

    // Estado
    status: 'active' | 'trial' | 'suspended' | 'cancelled';
    trialEndsAt?: any;
    currentPeriodStart: any;
    currentPeriodEnd: any;
    nextBillingDate: any;

    // Pago
    paymentMethod?: 'credit_card' | 'bank_transfer' | 'mercadopago';
    lastPaymentDate?: any;
    lastPaymentAmount?: number;
}

/** Módulos que incluye el Plan Zoovia por defecto */
export const ZOOVIA_PLAN_MODULES: SubscriptionModules = {
    clients: true,
    pets: true,
    medicalRecords: true,
    appointments: true,
    loyalty: true,
    grooming: false,
    inventory: false,
};
