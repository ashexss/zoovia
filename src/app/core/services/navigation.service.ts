import { Injectable, inject } from '@angular/core';
import { Observable, map, combineLatest, of } from 'rxjs';
import { SubscriptionService } from './subscription.service';
import { VeterinaryService } from './veterinary.service';

export interface MenuItem {
    icon: string;
    label: string;
    route: string;
    badge?: number | Observable<number>;
    role?: string; // Optional role requirement
}

@Injectable({
    providedIn: 'root'
})
export class NavigationService {
    private subscriptionService = inject(SubscriptionService);
    private veterinaryService = inject(VeterinaryService);

    getMenuItems(): Observable<MenuItem[]> {
        return this.veterinaryService.getCurrentVeterinary().pipe(
            map(vet => {
                const items: MenuItem[] = [];

                // Always present items
                items.push({ icon: 'dashboard', label: 'Inicio', route: '/dashboard' });
                items.push({ icon: 'people', label: 'Clientes', route: '/dashboard/clients' });
                items.push({ icon: 'pets', label: 'Mascotas', route: '/dashboard/pets' });

                if (!vet || !vet.subscription) {
                    // Fallback or basic items if no subscription data
                    items.push({ icon: 'settings', label: 'Configuración', route: '/dashboard/settings' });
                    return items;
                }

                const sub = vet.subscription;

                // Medical Records - Core for Veterinary, not for Grooming
                if (sub.modules.medicalRecords) {
                    items.push({
                        icon: 'medical_services',
                        label: 'Historiales',
                        route: '/dashboard/medical-records'
                    });
                }

                // Optional Modules
                if (sub.modules.appointments) {
                    items.push({
                        icon: 'event',
                        label: 'Turnos',
                        route: '/dashboard/appointments'
                        // badge: this.getAppointmentsCount() // TODO: Implement
                    });
                }

                if (sub.modules.grooming) {
                    items.push({
                        icon: 'content_cut',
                        label: 'Peluquería',
                        route: '/dashboard/grooming'
                    });
                }

                if (sub.modules.inventory) {
                    items.push({
                        icon: 'inventory',
                        label: 'Inventario',
                        route: '/dashboard/inventory'
                    });
                }

                // Settings always last
                items.push({ icon: 'settings', label: 'Configuración', route: '/dashboard/settings' });

                return items;
            })
        );
    }
}
