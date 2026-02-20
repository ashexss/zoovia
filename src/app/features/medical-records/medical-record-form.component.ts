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
        { value: 'vaccination', label: 'Vacunación' },
        { value: 'surgery', label: 'Cirugía' },
        { value: 'treatment', label: 'Tratamiento' },
        { value: 'checkup', label: 'Chequeo' }
    ];

    ngOnInit(): void {
        this.initForm();
        this.loadData();
        this.checkEditMode();
        this.setupClientChangeListener();
    }

    /**
     * Initialize the form
     */
    initForm(): void {
        this.recordForm = this.fb.group({
            clientId: ['', Validators.required],
            petId: ['', Validators.required],
            date: [new Date(), Validators.required],
            type: ['consultation', Validators.required],
            diagnosis: ['', Validators.required],
            treatment: ['', Validators.required],
            notes: [''],
            prescriptions: this.fb.array([])
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
                // Reset pet selection if current pet doesn't belong to selected client
                const currentPetId = this.recordForm.get('petId')?.value;
                if (currentPetId && !this.filteredPets.find(p => p.id === currentPetId)) {
                    this.recordForm.patchValue({ petId: '' });
                }
            } else {
                this.filteredPets = [];
                this.recordForm.patchValue({ petId: '' });
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
            const formValue = this.recordForm.value;

            // Convert Date to Timestamp
            const recordData: Partial<MedicalRecord> = {
                ...formValue,
                date: Timestamp.fromDate(formValue.date)
            };

            if (this.isEditMode && this.recordId) {
                await this.recordService.updateRecord(this.recordId, recordData);
                alert('Registro actualizado exitosamente');
            } else {
                await this.recordService.createRecord(recordData);
                alert('Registro creado exitosamente');
            }

            this.router.navigate(['/dashboard/medical-records']);
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
        this.router.navigate(['/dashboard/medical-records']);
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
