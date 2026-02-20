import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { VeterinaryService } from '../../core/services/veterinary.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { Veterinary, Subscription, SubscriptionModules, BusinessType } from '../../core/models';

interface ModuleInfo {
    key: keyof SubscriptionModules;
    name: string;
    icon: string;
    description: string;
    price: number;
    available: boolean; // true if compatible with this business type
}

@Component({
    selector: 'app-subscription-overview',
    standalone: true,
    imports: [
        CommonModule, RouterModule, MatCardModule, MatButtonModule,
        MatIconModule, MatChipsModule, MatDividerModule,
        MatSlideToggleModule, MatSnackBarModule, MatProgressSpinnerModule
    ],
    templateUrl: './subscription-overview.component.html',
    styleUrls: ['./subscription-overview.component.scss']
})
export class SubscriptionOverviewComponent implements OnInit {
    private vetService = inject(VeterinaryService);
    private subscriptionService = inject(SubscriptionService);
    private snackBar = inject(MatSnackBar);

    veterinary?: Veterinary;
    saving = false;

    readonly allModules: ModuleInfo[] = [
        {
            key: 'appointments', name: 'Turnos', icon: 'event',
            description: 'Agenda diaria, turnos por orden de llegada y acceso rápido al historial.',
            price: 8, available: true
        },
        {
            key: 'grooming', name: 'Peluquería', icon: 'content_cut',
            description: 'Servicios de peluquería, precios y agenda de grooming canino.',
            price: 10, available: true
        },
        {
            key: 'inventory', name: 'Inventario', icon: 'inventory',
            description: 'Control de stock de medicamentos, insumos y alertas de bajo stock.',
            price: 12, available: true
        }
    ];

    ngOnInit() {
        this.vetService.getCurrentVeterinary().subscribe(vet => {
            this.veterinary = vet;
        });
    }

    get subscription(): Subscription | undefined {
        return this.veterinary?.subscription;
    }

    get statusLabel(): string {
        const s = this.subscription?.status;
        if (s === 'trial') {
            const end = this.subscription?.trialEndsAt?.toDate?.();
            if (end) {
                const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
                return `Prueba gratuita — ${days} días restantes`;
            }
            return 'Prueba gratuita';
        }
        if (s === 'active') return 'Plan activo';
        if (s === 'suspended') return '⚠️ Suspendida';
        if (s === 'cancelled') return 'Cancelada';
        return '—';
    }

    get statusColor(): string {
        const s = this.subscription?.status;
        if (s === 'active') return 'success';
        if (s === 'trial') return 'info';
        return 'warn';
    }

    get currentMonthlyPrice(): number {
        if (!this.veterinary) return 0;
        return this.subscriptionService.calculatePrice(
            this.veterinary.subscription.plan,
            this.veterinary.subscription.modules
        );
    }

    isModuleActive(key: keyof SubscriptionModules): boolean {
        return this.subscription?.modules[key] === true;
    }

    availableModules(): ModuleInfo[] {
        // grooming module is not offered as add-on to pure grooming shops (already bundled)
        return this.allModules.filter(m => {
            if (m.key === 'grooming' && this.veterinary?.businessType === BusinessType.GROOMING) {
                return false;
            }
            return true;
        });
    }

    async toggleModule(module: ModuleInfo) {
        if (!this.veterinary || this.saving) return;
        this.saving = true;

        try {
            const currentModules = { ...this.veterinary.subscription.modules };
            currentModules[module.key] = !currentModules[module.key];

            await this.vetService.updateVeterinary(this.veterinary.id, {
                subscription: {
                    ...this.veterinary.subscription,
                    modules: currentModules
                }
            });

            // Refresh local state
            const updated = await this.vetService.getCurrentVeterinary().toPromise();
            if (updated) this.veterinary = updated;

            const action = currentModules[module.key] ? 'activado' : 'desactivado';
            this.snackBar.open(`Módulo "${module.name}" ${action}`, 'OK', { duration: 3000 });
        } catch (e) {
            console.error(e);
            this.snackBar.open('Error al actualizar el módulo', 'Cerrar', { duration: 3000 });
        } finally {
            this.saving = false;
        }
    }

    getBusinessTypeLabel(): string {
        const bt = this.veterinary?.businessType;
        if (bt === BusinessType.VETERINARY) return 'Veterinaria';
        if (bt === BusinessType.GROOMING) return 'Peluquería';
        if (bt === BusinessType.HYBRID) return 'Veterinaria + Peluquería';
        return 'Negocio';
    }
}
