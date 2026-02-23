import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { Timestamp } from '@angular/fire/firestore';
import { combineLatest } from 'rxjs';

import { MedicalRecord, Pet, Client, MedicalRecordType, Prescription } from '../../core/models';
import { MedicalRecordService, PetService, ClientService } from '../../core/services';

@Component({
    selector: 'app-medical-record-form',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatProgressSpinnerModule,
        MatDividerModule
    ],
    templateUrl: './medical-record-form.component.html',
    styleUrls: ['./medical-record-form.component.scss']
})
export class MedicalRecordFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private recordService = inject(MedicalRecordService);
    private petService = inject(PetService);
    private clientService = inject(ClientService);

    recordForm!: FormGroup;
    isEditMode = false;
    recordId: string | null = null;
    loading = false;
    saving = false;

    clients: Client[] = [];
    pets: Pet[] = [];
    filteredPets: Pet[] = [];
    loadingData = false;

    recordTypes: { value: MedicalRecordType; label: string }[] = [
        { value: 'consultation', label: 'Consulta' },
        { value: 'surgery', label: 'Cirugía' },
        { value: 'checkup', label: 'Control' }
    ];

    ngOnInit(): void {
        this.initForm();
        this.setupClientChangeListener();
        this.loadData();
        this.checkEditMode();
    }

    /**
     * Initialize the form
     */
    initForm(): void {
        this.recordForm = this.fb.group({
            clientId: ['', Validators.required],
            petId: [{ value: '', disabled: true }, Validators.required],
            date: [new Date(), Validators.required],
            type: ['consultation', Validators.required],
            diagnosisAndTreatment: ['', Validators.required],
            notes: [''],
            prescriptions: this.fb.array([]),
            vaccines: this.fb.array([]),
            deworming: this.fb.array([])
        });
    }

    /**
     * Get prescriptions form array
     */
    get prescriptions(): FormArray {
        return this.recordForm.get('prescriptions') as FormArray;
    }

    /**
     * Create a new prescription form group
     */
    createPrescriptionGroup(prescription?: Prescription): FormGroup {
        return this.fb.group({
            medication: [prescription?.medication || '', Validators.required],
            dosage: [prescription?.dosage || '', Validators.required],
            frequency: [prescription?.frequency || '', Validators.required],
            duration: [prescription?.duration || '', Validators.required],
            price: [prescription?.price || 0, [Validators.min(0)]]
        });
    }

    /**
     * Add a new prescription
     */
    addPrescription(): void {
        this.prescriptions.push(this.createPrescriptionGroup());
    }

    /**
     * Remove a prescription
     */
    removePrescription(index: number): void {
        this.prescriptions.removeAt(index);
    }

    /**
     * Get vaccines form array
     */
    get vaccines(): FormArray {
        return this.recordForm.get('vaccines') as FormArray;
    }

    createVaccineGroup(vaccine?: any): FormGroup {
        let expDate = vaccine?.expirationDate;
        if (expDate && expDate.toDate) expDate = expDate.toDate();

        return this.fb.group({
            name: [vaccine?.name || '', Validators.required],
            expirationDate: [expDate || null, Validators.required]
        });
    }

    addVaccine(): void {
        this.vaccines.push(this.createVaccineGroup());
    }

    removeVaccine(index: number): void {
        this.vaccines.removeAt(index);
    }

    /**
     * Get deworming form array
     */
    get deworming(): FormArray {
        return this.recordForm.get('deworming') as FormArray;
    }

    createDewormingGroup(deworm?: any): FormGroup {
        let expDate = deworm?.expirationDate;
        if (expDate && expDate.toDate) expDate = expDate.toDate();

        return this.fb.group({
            name: [deworm?.name || '', Validators.required],
            type: [deworm?.type || 'both', Validators.required],
            expirationDate: [expDate || null, Validators.required]
        });
    }

    addDeworming(): void {
        this.deworming.push(this.createDewormingGroup());
    }

    removeDeworming(index: number): void {
        this.deworming.removeAt(index);
    }

    /**
     * Load clients and pets
     */
    loadData(): void {
        this.loadingData = true;

        combineLatest([
            this.clientService.getClients(),
            this.petService.getPets()
        ]).subscribe({
            next: ([clients, pets]) => {
                this.clients = clients;
                this.pets = pets.filter(p => p.isActive);
                this.loadingData = false;

                // Pre-fill from query params if available and not in edit mode
                if (!this.isEditMode) {
                    const params = this.route.snapshot.queryParamMap;
                    const clientId = params.get('clientId');
                    const petId = params.get('petId');

                    if (clientId) {
                        this.recordForm.patchValue({ clientId });
                        // setupClientChangeListener will trigger and filter pets, then we can patch petId
                        if (petId) {
                            // Small timeout to allow the pets to filter first
                            setTimeout(() => {
                                this.recordForm.patchValue({ petId });
                            }, 0);
                        }
                    }
                }
            },
            error: (error) => {
                console.error('Error loading data:', error);
                this.loadingData = false;
                alert('Error al cargar los datos');
            }
        });
    }

    /**
     * Setup listener for client changes to filter pets
     */
    setupClientChangeListener(): void {
        this.recordForm.get('clientId')?.valueChanges.subscribe(clientId => {
            if (clientId) {
                this.filteredPets = this.pets.filter(pet => pet.clientId === clientId);
                this.recordForm.get('petId')?.enable();
                // Reset pet selection if current pet doesn't belong to selected client
                const currentPetId = this.recordForm.get('petId')?.value;
                if (currentPetId && !this.filteredPets.find(p => p.id === currentPetId)) {
                    this.recordForm.patchValue({ petId: '' });
                }
            } else {
                this.filteredPets = [];
                this.recordForm.patchValue({ petId: '' });
                this.recordForm.get('petId')?.disable();
            }
        });
    }

    /**
     * Check if we're in edit mode and load record data
     */
    checkEditMode(): void {
        this.recordId = this.route.snapshot.paramMap.get('id');
        if (this.recordId) {
            this.isEditMode = true;
            this.loadRecord(this.recordId);
        }
    }

    /**
     * Load record data for editing
     */
    loadRecord(id: string): void {
        this.loading = true;
        this.recordService.getRecordById(id).subscribe({
            next: (record) => {
                if (record) {
                    // Update form patching logic
                    this.recordForm.patchValue({ clientId: record.clientId });
                    // Small timeout to allow the clientListener to filter the pets list
                    setTimeout(() => {
                        this.recordForm.patchValue({ petId: record.petId });
                    }, 0);

                    // Convert Timestamp to Date
                    const formData = {
                        ...record,
                        date: record.date.toDate()
                    };

                    // Load prescriptions
                    if (record.prescriptions && record.prescriptions.length > 0) {
                        record.prescriptions.forEach(prescription => {
                            this.prescriptions.push(this.createPrescriptionGroup(prescription));
                        });
                    }

                    // Load vaccines
                    if (record.vaccines && record.vaccines.length > 0) {
                        record.vaccines.forEach(vaccine => {
                            this.vaccines.push(this.createVaccineGroup(vaccine));
                        });
                    }

                    // Load deworming
                    if (record.deworming && record.deworming.length > 0) {
                        record.deworming.forEach(deworm => {
                            this.deworming.push(this.createDewormingGroup(deworm));
                        });
                    }

                    this.recordForm.patchValue(formData);
                }
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading record:', error);
                this.loading = false;
                alert('Error al cargar el registro');
                this.router.navigate(['/dashboard/medical-records']);
            }
        });
    }

    /**
     * Submit the form
     */
    async onSubmit(): Promise<void> {
        if (this.recordForm.invalid) {
            this.recordForm.markAllAsTouched();
            return;
        }

        this.saving = true;

        try {
            // Use getRawValue() to include fields that might be disabled (like petId)
            const formValue = this.recordForm.getRawValue();

            // Format form array dates to Timestamp
            const vaccines = formValue.vaccines ? formValue.vaccines.map((v: any) => ({
                ...v,
                expirationDate: v.expirationDate ? Timestamp.fromDate(v.expirationDate) : null
            })) : [];

            const deworming = formValue.deworming ? formValue.deworming.map((d: any) => ({
                ...d,
                expirationDate: d.expirationDate ? Timestamp.fromDate(d.expirationDate) : null
            })) : [];

            // Convert Date to Timestamp
            const recordData: Partial<MedicalRecord> = {
                ...formValue,
                date: Timestamp.fromDate(formValue.date),
                vaccines,
                deworming
            };

            if (this.isEditMode && this.recordId) {
                await this.recordService.updateRecord(this.recordId, recordData);
                alert('Registro actualizado exitosamente');
            } else {
                await this.recordService.createRecord(recordData);
                alert('Registro creado exitosamente');
            }
            if (formValue.petId) {
                this.router.navigate(['/dashboard/pets', formValue.petId]);
            } else {
                this.router.navigate(['/dashboard/medical-records']);
            }
        } catch (error) {
            console.error('Error saving record:', error);
            alert('Error al guardar el registro');
        } finally {
            this.saving = false;
        }
    }

    /**
     * Cancel and go back
     */
    onCancel(): void {
        const petId = this.recordForm.getRawValue().petId;
        if (petId) {
            this.router.navigate(['/dashboard/pets', petId]);
        } else {
            this.router.navigate(['/dashboard/medical-records']);
        }
    }

    /**
     * Get error message for a field
     */
    getErrorMessage(fieldName: string): string {
        const field = this.recordForm.get(fieldName);
        if (!field) return '';

        if (field.hasError('required')) {
            return 'Este campo es requerido';
        }
        if (field.hasError('min')) {
            return 'El valor debe ser mayor o igual a 0';
        }
        return '';
    }

    /**
     * Get client display name
     */
    getClientDisplayName(client: Client): string {
        return `${client.firstName} ${client.lastName}`;
    }

    /**
     * Get pet display name
     */
    getPetDisplayName(pet: Pet): string {
        return `${pet.name} (${pet.species})`;
    }

    /**
     * Calculate total prescription cost
     */
    getTotalCost(): number {
        return this.prescriptions.controls.reduce((total, control) => {
            return total + (control.get('price')?.value || 0);
        }, 0);
    }
}
