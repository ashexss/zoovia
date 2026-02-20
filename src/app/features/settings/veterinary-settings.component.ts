import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';

import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { VeterinaryService } from '../../core/services';
import { Veterinary, BusinessHours, ClosedDate, VacationPeriod, LoyaltyProgram } from '../../core/models';
import { DEFAULT_LOYALTY_PROGRAM } from '../../core/services/loyalty.service';
import { BusinessHoursEditorComponent } from './business-hours-editor.component';
import { ClosedDatesManagerComponent } from './closed-dates-manager.component';
import { VacationPeriodsManagerComponent } from './vacation-periods-manager.component';
import { SubscriptionOverviewComponent } from '../subscription/subscription-overview.component';

@Component({
    selector: 'app-veterinary-settings',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatTabsModule,
        MatSlideToggleModule,
        BusinessHoursEditorComponent,
        ClosedDatesManagerComponent,
        VacationPeriodsManagerComponent,
        SubscriptionOverviewComponent
    ],
    templateUrl: './veterinary-settings.component.html',
    styleUrls: ['./veterinary-settings.component.scss']
})
export class VeterinarySettingsComponent implements OnInit {
    private fb = inject(FormBuilder);
    private veterinaryService = inject(VeterinaryService);
    private snackBar = inject(MatSnackBar);
    private cdr = inject(ChangeDetectorRef);

    veterinary?: Veterinary;
    loading = true;
    saving = false;
    uploadingLogo = false;
    hasPermissionError = false;

    generalForm!: FormGroup;
    addressForm!: FormGroup;
    loyaltyForm!: FormGroup;

    // New properties for child components
    businessHours?: BusinessHours;
    closedDates: ClosedDate[] = [];
    vacationPeriods: VacationPeriod[] = [];

    logoPreview?: string;
    selectedLogoFile?: File;

    daysOfWeek = [
        { key: 'monday', label: 'Lunes' },
        { key: 'tuesday', label: 'Martes' },
        { key: 'wednesday', label: 'Miércoles' },
        { key: 'thursday', label: 'Jueves' },
        { key: 'friday', label: 'Viernes' },
        { key: 'saturday', label: 'Sábado' },
        { key: 'sunday', label: 'Domingo' }
    ];

    ngOnInit(): void {
        this.initializeForms();
        // Delay loading to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
            this.loadVeterinary();
        }, 0);
    }

    initializeForms(): void {
        this.generalForm = this.fb.group({
            name: ['', Validators.required],
            phone: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]]
        });

        this.addressForm = this.fb.group({
            street: [''],
            city: [''],
            state: [''],
            zipCode: [''],
            country: ['']
        });

        const def = DEFAULT_LOYALTY_PROGRAM;
        this.loyaltyForm = this.fb.group({
            enabled: [def.enabled],
            pointsPerVisit: [def.pointsPerVisit, [Validators.required, Validators.min(0)]],
            pointsPerGrooming: [def.pointsPerGrooming, [Validators.required, Validators.min(0)]],
            pointsPerPurchasePeso: [def.pointsPerPurchasePeso, [Validators.required, Validators.min(0)]],
            redemptionRate: [def.redemptionRate, [Validators.required, Validators.min(1)]],
            tierSilver: [def.tiers.silver, [Validators.required, Validators.min(1)]],
            tierGold: [def.tiers.gold, [Validators.required, Validators.min(1)]],
            tierPlatinum: [def.tiers.platinum, [Validators.required, Validators.min(1)]]
        });
    }

    loadVeterinary(): void {
        this.loading = true;
        this.hasPermissionError = false;

        this.veterinaryService.getCurrentVeterinary().subscribe({
            next: (vet) => {
                if (vet) {
                    this.veterinary = vet;
                    this.populateForms(vet);
                    this.logoPreview = vet.logo;
                    // Silently backfill subscription data for pre-existing documents
                    this.veterinaryService.ensureSubscription(vet.id).catch(err =>
                        console.warn('[VeterinarySettings] Could not migrate subscription data:', err)
                    );
                } else {
                    console.warn('[VeterinarySettings] No veterinary data found for current user');
                }
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Error loading veterinary:', error);
                this.loading = false;

                // Check if it's a permissions error
                if (error.code === 'permission-denied' || error.message?.includes('permission')) {
                    this.hasPermissionError = true;
                    this.snackBar.open(
                        'Error de permisos: Necesitás configurar las reglas de Firestore',
                        'Ver Guía',
                        {
                            duration: 10000,
                            horizontalPosition: 'center',
                            verticalPosition: 'top'
                        }
                    );
                } else {
                    this.snackBar.open('Error al cargar la información', 'Cerrar', { duration: 3000 });
                }

                this.cdr.detectChanges();
            }
        });
    }

    populateForms(vet: Veterinary): void {
        this.generalForm.patchValue({
            name: vet.name,
            phone: vet.phone,
            email: vet.email
        });

        if (vet.address) {
            this.addressForm.patchValue(vet.address);
        }

        this.businessHours = vet.businessHours;
        this.closedDates = vet.closedDates || [];
        this.vacationPeriods = vet.vacationPeriods || [];

        // Loyalty program
        const lp = vet.loyaltyProgram ?? DEFAULT_LOYALTY_PROGRAM;
        this.loyaltyForm.patchValue({
            enabled: lp.enabled,
            pointsPerVisit: lp.pointsPerVisit,
            pointsPerGrooming: lp.pointsPerGrooming,
            pointsPerPurchasePeso: lp.pointsPerPurchasePeso,
            redemptionRate: lp.redemptionRate,
            tierSilver: lp.tiers.silver,
            tierGold: lp.tiers.gold,
            tierPlatinum: lp.tiers.platinum
        });
    }

    // Event handlers for child components
    onBusinessHoursChange(hours: BusinessHours): void {
        this.businessHours = hours;
    }

    onClosedDatesChange(dates: ClosedDate[]): void {
        this.closedDates = dates;
    }

    onVacationPeriodsChange(periods: VacationPeriod[]): void {
        this.vacationPeriods = periods;
    }

    onLogoSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];

            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.snackBar.open('Por favor selecciona una imagen', 'Cerrar', { duration: 3000 });
                return;
            }

            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                this.snackBar.open('La imagen no debe superar 2MB', 'Cerrar', { duration: 3000 });
                return;
            }

            this.selectedLogoFile = file;

            // Preview
            const reader = new FileReader();
            reader.onload = (e) => {
                this.logoPreview = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    }

    async uploadLogo(): Promise<string | undefined> {
        if (!this.selectedLogoFile || !this.veterinary) return undefined;

        this.uploadingLogo = true;
        try {
            const logoUrl = await this.veterinaryService.uploadLogo(this.veterinary.id, this.selectedLogoFile);
            this.uploadingLogo = false;
            return logoUrl;
        } catch (error) {
            console.error('Error uploading logo:', error);
            this.snackBar.open('Error al subir el logo', 'Cerrar', { duration: 3000 });
            this.uploadingLogo = false;
            return undefined;
        }
    }

    async saveChanges(): Promise<void> {
        if (!this.veterinary) return;

        if (this.generalForm.invalid || this.addressForm.invalid) {
            this.snackBar.open('Por favor completa todos los campos requeridos', 'Cerrar', { duration: 3000 });
            return;
        }

        this.saving = true;

        try {
            // Upload logo if changed
            let logoUrl = this.veterinary.logo;
            if (this.selectedLogoFile) {
                const newLogoUrl = await this.uploadLogo();
                if (newLogoUrl) {
                    logoUrl = newLogoUrl;
                }
            }

            // Loyalty program config
            const lv = this.loyaltyForm.value;
            const loyaltyProgram: LoyaltyProgram = {
                enabled: lv.enabled,
                pointsPerVisit: +lv.pointsPerVisit,
                pointsPerGrooming: +lv.pointsPerGrooming,
                pointsPerPurchasePeso: +lv.pointsPerPurchasePeso,
                redemptionRate: +lv.redemptionRate,
                tiers: {
                    bronze: 0,
                    silver: +lv.tierSilver,
                    gold: +lv.tierGold,
                    platinum: +lv.tierPlatinum
                }
            };

            // Prepare update data
            const updateData: Partial<Veterinary> = {
                name: this.generalForm.value.name,
                phone: this.generalForm.value.phone,
                email: this.generalForm.value.email,
                address: this.addressForm.value,
                businessHours: this.businessHours,
                closedDates: this.closedDates,
                vacationPeriods: this.vacationPeriods,
                logo: logoUrl,
                loyaltyProgram
            };

            // Update veterinary
            await this.veterinaryService.updateVeterinary(this.veterinary.id, updateData);

            this.snackBar.open('Cambios guardados exitosamente', 'Cerrar', { duration: 3000 });
            this.selectedLogoFile = undefined;
            this.saving = false;

            // Reload data
            this.loadVeterinary();
        } catch (error) {
            console.error('Error saving changes:', error);
            this.snackBar.open('Error al guardar los cambios', 'Cerrar', { duration: 3000 });
            this.saving = false;
        }
    }

}
