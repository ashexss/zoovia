import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Timestamp } from '@angular/fire/firestore';

import { SuperadminService } from '../../core/services/superadmin.service';
import { Veterinary, Subscription, SubscriptionModules, SubscriptionPlan, ZOOVIA_PLAN_MODULES, BusinessType } from '../../core/models';

interface ModuleInfo { key: keyof SubscriptionModules; name: string; icon: string; }

@Component({
    selector: 'app-superadmin-dashboard',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule,
        MatIconModule, MatButtonModule, MatSelectModule, MatInputModule,
        MatFormFieldModule, MatSlideToggleModule, MatProgressSpinnerModule, MatSnackBarModule
    ],
    templateUrl: './superadmin-dashboard.component.html',
    styleUrls: ['./superadmin-dashboard.component.scss']
})
export class SuperadminDashboardComponent implements OnInit {
    private superadminService = inject(SuperadminService);
    private fb = inject(FormBuilder);
    private snackBar = inject(MatSnackBar);
    private cdr = inject(ChangeDetectorRef);

    vets: Veterinary[] = [];
    selectedVet: Veterinary | null = null;
    loading = true;
    saving = false;
    saveSuccess = false;

    subForm!: FormGroup;

    readonly allModules: ModuleInfo[] = [
        { key: 'clients', name: 'Clientes y Mascotas', icon: 'pets' },
        { key: 'medicalRecords', name: 'Historiales Clínicos', icon: 'medical_services' },
        { key: 'appointments', name: 'Turnos y Agenda', icon: 'event' },
        { key: 'loyalty', name: 'Fidelización (Puntos)', icon: 'star' },
        { key: 'grooming', name: 'Peluquería', icon: 'content_cut' },
        { key: 'inventory', name: 'Inventario', icon: 'inventory' },
    ];

    ngOnInit() {
        this.buildForm();
        this.loadVets();
    }

    buildForm() {
        const controls: Record<string, any> = {
            plan: ['zoovia_plan'],
            status: ['active'],
            monthlyPrice: [59900, [Validators.required, Validators.min(0)]],
            billingCycle: ['monthly'],
            nextBillingDate: [''],
        };
        for (const mod of this.allModules) {
            controls[`mod_${mod.key}`] = [false];
        }
        this.subForm = this.fb.group(controls);
    }

    async loadVets() {
        this.loading = true;
        try {
            this.vets = await this.superadminService.getAllVeterinaries();
        } catch (e) {
            console.error(e);
            this.snackBar.open('Error al cargar veterinarias', 'Cerrar', { duration: 4000 });
        } finally {
            this.loading = false;
            this.cdr.detectChanges();
        }
    }

    selectVet(vet: Veterinary) {
        this.selectedVet = vet;
        this.saveSuccess = false;
        this.populateForm(vet.subscription);
    }

    populateForm(sub: Subscription | undefined) {
        if (!sub) return;

        const nextDate = sub.nextBillingDate?.toDate?.();
        const nextDateStr = nextDate
            ? nextDate.toISOString().split('T')[0]
            : '';

        this.subForm.patchValue({
            plan: sub.plan ?? 'base_vet',
            status: sub.status ?? 'active',
            monthlyPrice: sub.monthlyPrice ?? 0,
            billingCycle: sub.billingCycle ?? 'monthly',
            nextBillingDate: nextDateStr,
        });

        for (const mod of this.allModules) {
            this.subForm.patchValue({
                [`mod_${mod.key}`]: sub.modules?.[mod.key] ?? false
            });
        }
    }

    /** When plan changes to 'zoovia_plan', auto-fill modules */
    onPlanChange(plan: SubscriptionPlan) {
        if (plan === 'zoovia_plan') {
            this.subForm.patchValue({ monthlyPrice: 59900 });
            for (const mod of this.allModules) {
                this.subForm.patchValue({
                    [`mod_${mod.key}`]: ZOOVIA_PLAN_MODULES[mod.key]
                });
            }
        }
    }

    async saveSubscription() {
        if (!this.selectedVet || this.subForm.invalid || this.saving) return;
        this.saving = true;
        this.saveSuccess = false;

        try {
            const v = this.subForm.value;

            const modules: SubscriptionModules = {} as SubscriptionModules;
            for (const mod of this.allModules) {
                (modules as any)[mod.key] = v[`mod_${mod.key}`] ?? false;
            }
            // clients and pets are always true
            modules.clients = true;
            modules.pets = true;

            const nextDate = v.nextBillingDate
                ? Timestamp.fromDate(new Date(v.nextBillingDate))
                : this.selectedVet.subscription?.nextBillingDate ?? Timestamp.now();

            const updated: Subscription = {
                plan: v.plan,
                businessType: this.selectedVet.subscription?.businessType ?? BusinessType.VETERINARY,
                modules,
                billingCycle: v.billingCycle,
                monthlyPrice: +v.monthlyPrice,
                currency: this.selectedVet.subscription?.currency ?? 'ARS',
                status: v.status,
                billingContactEmail: this.selectedVet.subscription?.billingContactEmail,
                paymentMethod: this.selectedVet.subscription?.paymentMethod,
                currentPeriodStart: this.selectedVet.subscription?.currentPeriodStart ?? Timestamp.now(),
                currentPeriodEnd: nextDate,
                nextBillingDate: nextDate,
                lastPaymentDate: this.selectedVet.subscription?.lastPaymentDate,
                lastPaymentAmount: this.selectedVet.subscription?.lastPaymentAmount,
            };

            await this.superadminService.updateSubscription(this.selectedVet.id, updated);

            // Refresh local vet data
            this.selectedVet = { ...this.selectedVet, subscription: updated };
            const idx = this.vets.findIndex(v => v.id === this.selectedVet!.id);
            if (idx >= 0) this.vets[idx] = { ...this.vets[idx], subscription: updated };

            this.saveSuccess = true;
            this.snackBar.open('✅ Suscripción actualizada', 'OK', { duration: 3000 });
        } catch (e) {
            console.error(e);
            this.snackBar.open('Error al guardar. Revisá los permisos de Firestore.', 'Cerrar', { duration: 5000 });
        } finally {
            this.saving = false;
        }
    }

    getPlanLabel(plan?: string): string {
        if (plan === 'zoovia_plan') return 'Zoovia';
        if (plan === 'base_vet') return 'Base';
        if (plan === 'custom') return 'Custom';
        return plan ?? '—';
    }

    getStatusLabel(status?: string): string {
        if (status === 'active') return 'Activa';
        if (status === 'trial') return 'Prueba';
        if (status === 'suspended') return 'Suspendida';
        if (status === 'cancelled') return 'Cancelada';
        return status ?? '—';
    }
}
