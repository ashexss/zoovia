import { Component, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { VeterinaryService } from '../../core/services/veterinary.service';
import { Veterinary, Subscription, SubscriptionModules } from '../../core/models';

interface ModuleInfo {
    key: keyof SubscriptionModules;
    name: string;
    icon: string;
    description: string;
    /** true = incluido en el plan base/zoovia, false = add-on */
    includedInBase: boolean;
}

@Component({
    selector: 'app-subscription-overview',
    standalone: true,
    imports: [
        CommonModule, DecimalPipe, ReactiveFormsModule,
        MatCardModule, MatButtonModule, MatIconModule, MatDividerModule,
        MatSnackBarModule, MatProgressSpinnerModule,
        MatFormFieldModule, MatInputModule
    ],
    templateUrl: './subscription-overview.component.html',
    styleUrls: ['./subscription-overview.component.scss']
})
export class SubscriptionOverviewComponent implements OnChanges {
    private vetService = inject(VeterinaryService);
    private snackBar = inject(MatSnackBar);
    private fb = inject(FormBuilder);

    @Input() veterinary?: Veterinary;

    savingBilling = false;
    billingForm: FormGroup = this.fb.group({
        billingContactEmail: ['', [Validators.email]]
    });

    /** Definición de todos los módulos del sistema */
    readonly allModules: ModuleInfo[] = [
        {
            key: 'clients', name: 'Clientes y Mascotas', icon: 'pets',
            description: 'Gestión completa de clientes, mascotas e historiales clínicos.',
            includedInBase: true
        },
        {
            key: 'medicalRecords', name: 'Historiales Clínicos', icon: 'medical_services',
            description: 'Registros de consultas, diagnósticos y tratamientos por mascota.',
            includedInBase: true
        },
        {
            key: 'appointments', name: 'Turnos y Agenda', icon: 'event',
            description: 'Agenda diaria, turnos programados y walk-ins con panel de estadísticas.',
            includedInBase: true
        },
        {
            key: 'loyalty', name: 'Programa de Fidelización', icon: 'star',
            description: 'Sistema de puntos por visita, niveles Bronce/Plata/Oro/Platino y canje.',
            includedInBase: true
        },
        {
            key: 'grooming', name: 'Peluquería', icon: 'content_cut',
            description: 'Agenda separada para servicios de grooming y peluquería canina.',
            includedInBase: false
        },
        {
            key: 'inventory', name: 'Inventario', icon: 'inventory',
            description: 'Control de stock de medicamentos, insumos y alertas de reposición.',
            includedInBase: false
        },
    ];

    ngOnChanges(changes: SimpleChanges) {
        if (changes['veterinary'] && this.veterinary) {
            if (this.veterinary.subscription?.billingContactEmail) {
                this.billingForm.patchValue({
                    billingContactEmail: this.veterinary.subscription.billingContactEmail
                });
                this.billingForm.markAsPristine();
            }
        }
    }

    get subscription(): Subscription | undefined {
        return this.veterinary?.subscription;
    }

    get planDisplayName(): string {
        const plan = this.subscription?.plan;
        if (plan === 'zoovia_plan') return 'Plan Zoovia';
        if (plan === 'base_vet') return 'Plan Base Veterinaria';
        if (plan === 'complete_vet') return 'Plan Completo';
        if (plan === 'custom') return 'Plan Personalizado';
        return plan ?? 'Sin plan';
    }

    get statusLabel(): string {
        const s = this.subscription?.status;
        if (s === 'trial') {
            const end = this.subscription?.trialEndsAt?.toDate?.();
            if (end) {
                const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
                return `Período de prueba — quedan ${days} días`;
            }
            return 'Período de prueba activo';
        }
        if (s === 'active') return 'Suscripción activa';
        if (s === 'suspended') return 'Cuenta suspendida — contactá a Zoovia';
        if (s === 'cancelled') return 'Suscripción cancelada';
        return '—';
    }

    get nextBillingFormatted(): string {
        const date = this.subscription?.nextBillingDate?.toDate?.();
        if (!date) return '—';
        return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    get paymentMethodLabel(): string {
        const pm = this.subscription?.paymentMethod;
        if (pm === 'bank_transfer') return 'Transferencia bancaria';
        if (pm === 'credit_card') return 'Tarjeta de crédito';
        if (pm === 'mercadopago') return 'MercadoPago';
        return 'A coordinar';
    }

    isModuleActive(key: keyof SubscriptionModules): boolean {
        return this.subscription?.modules?.[key] === true;
    }

    /**
     * Módulos que están incluidos en el plan actual (se muestran como chips verdes).
     * Si el plan es 'zoovia_plan', se determinan por `includedInBase`.
     * Si el plan es otro, se muestran los que estén activos en subscription.modules.
     */
    get includedModules(): ModuleInfo[] {
        if (this.subscription?.plan === 'zoovia_plan') {
            return this.allModules.filter(m => m.includedInBase);
        }
        return this.allModules.filter(m => this.isModuleActive(m.key));
    }

    /** Módulos que son add-ons (peluquería, inventario, etc.) */
    get addonModules(): ModuleInfo[] {
        return this.allModules.filter(m => !m.includedInBase);
    }

    async saveBillingInfo() {
        if (!this.veterinary || !this.subscription || this.billingForm.invalid || this.billingForm.pristine) return;
        this.savingBilling = true;

        try {
            const email = this.billingForm.value.billingContactEmail ?? '';
            const currentSub = this.subscription;
            await this.vetService.updateVeterinary(this.veterinary.id, {
                subscription: {
                    ...currentSub,
                    billingContactEmail: email
                } as typeof currentSub
            });
            this.billingForm.markAsPristine();
            this.snackBar.open('Datos de facturación guardados', 'OK', { duration: 3000 });
        } catch (e) {
            console.error(e);
            this.snackBar.open('Error al guardar. Intentá de nuevo.', 'Cerrar', { duration: 3000 });
        } finally {
            this.savingBilling = false;
        }
    }
}
