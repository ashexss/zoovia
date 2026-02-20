import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { VeterinaryService } from './veterinary.service';
import { Subscription, SubscriptionModules, BusinessType, SubscriptionPlan } from '../models/subscription';
import { Veterinary } from '../models';

@Injectable({
    providedIn: 'root'
})
export class SubscriptionService {
    private veterinaryService = inject(VeterinaryService);

    /**
     * Prices configuration
     */
    private readonly PRICES = {
        PLANS: {
            base_vet: 15,
            base_grooming: 12,
            complete_vet: 35,
            complete_grooming: 25,
            custom: 0 // Calculated base + modules
        },
        MODULES: {
            appointments: 8,
            grooming: 10,
            inventory: 12
        }
    };

    /**
     * Check if the current veterinary has a specific module active
     */
    hasModule(module: keyof SubscriptionModules): Observable<boolean> {
        return this.veterinaryService.getCurrentVeterinary().pipe(
            map(vet => {
                if (!vet?.subscription) return false;

                // If trial is active, give access to everything (optional strategy)
                // or stick to what's defined in subscription.modules
                return vet.subscription.modules[module] === true;
            })
        );
    }

    /**
     * get current subscription
     */
    getSubscription(): Observable<Subscription | undefined> {
        return this.veterinaryService.getCurrentVeterinary().pipe(
            map(vet => vet?.subscription)
        );
    }

    /**
     * Calculate monthly price based on plan and modules
     */
    calculatePrice(plan: SubscriptionPlan, modules: SubscriptionModules): number {
        // Return fixed price for bundle plans
        if (plan === 'complete_vet') return this.PRICES.PLANS.complete_vet;
        if (plan === 'complete_grooming') return this.PRICES.PLANS.complete_grooming;

        // For base/custom plans, calculate base + add-ons
        let total = 0;

        // Base price
        if (plan === 'base_vet') total += this.PRICES.PLANS.base_vet;
        if (plan === 'base_grooming') total += this.PRICES.PLANS.base_grooming;

        // Add-ons
        if (modules.appointments) total += this.PRICES.MODULES.appointments;
        // Grooming module is extra only for vets, basically included in grooming base
        // But let's assume grooming module cost is for VETs usage.
        if (modules.grooming && plan !== 'base_grooming') {
            total += this.PRICES.MODULES.grooming;
        }
        if (modules.inventory) total += this.PRICES.MODULES.inventory;

        return total;
    }

    /**
     * Helper to determine default modules for a business type
     */
    getDefaultModules(type: BusinessType): SubscriptionModules {
        const defaults: SubscriptionModules = {
            clients: true,
            pets: true,
            medicalRecords: type === BusinessType.VETERINARY || type === BusinessType.HYBRID,
            appointments: false,
            grooming: type === BusinessType.GROOMING,
            inventory: false
        };
        return defaults;
    }

    /**
     * Check if feature is accessible (can be used for specific limits like maxUsers)
     */
    canAccessFeature(feature: string): Observable<boolean> {
        // Implementation for granular feature flags if needed
        return this.veterinaryService.getCurrentVeterinary().pipe(
            map(vet => {
                if (!vet) return false;
                // Add logic here if we have features other than modules
                return true;
            })
        );
    }

    /**
     * Check if subscription is active (paid or trial)
     */
    isSubscriptionActive(vet: Veterinary): boolean {
        if (!vet.subscription) return false;

        // Simple check for status
        if (vet.subscription.status === 'active' || vet.subscription.status === 'trial') {
            return true;
        }

        return false;
    }
}
