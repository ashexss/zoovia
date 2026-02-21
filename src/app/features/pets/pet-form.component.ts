import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Timestamp } from '@angular/fire/firestore';

import { Pet, Client, PetSpecies, PetGender } from '../../core/models';
import { PetService, ClientService } from '../../core/services';

@Component({
    selector: 'app-pet-form',
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
        MatProgressSpinnerModule
    ],
    templateUrl: './pet-form.component.html',
    styleUrls: ['./pet-form.component.scss']
})
export class PetFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private petService = inject(PetService);
    private clientService = inject(ClientService);

    petForm!: FormGroup;
    isEditMode = false;
    petId: string | null = null;
    loading = false;
    saving = false;

    clients: Client[] = [];
    loadingClients = false;

    speciesOptions: { value: PetSpecies; label: string }[] = [
        { value: 'dog', label: 'Perro' },
        { value: 'cat', label: 'Gato' },
        { value: 'bird', label: 'Ave' },
        { value: 'rabbit', label: 'Conejo' },
        { value: 'other', label: 'Otro' }
    ];

    genderOptions: { value: PetGender; label: string }[] = [
        { value: 'male', label: 'Macho' },
        { value: 'female', label: 'Hembra' }
    ];

    ngOnInit(): void {
        this.initForm();
        this.loadClients();
        this.checkEditMode();

        // Check if a clientId was passed in query params to auto-select the owner
        this.route.queryParams.subscribe(params => {
            if (params['clientId']) {
                this.petForm.patchValue({ clientId: params['clientId'] });
            }
        });
    }

    /**
     * Initialize the form
     */
    initForm(): void {
        this.petForm = this.fb.group({
            clientId: ['', Validators.required],
            name: ['', [Validators.required, Validators.minLength(2)]],
            species: ['dog', Validators.required],
            breed: ['', Validators.required],
            gender: ['male', Validators.required],
            birthDate: [new Date(), Validators.required],
            weight: [null, [Validators.required, Validators.min(0.1)]],
            color: [''],
            microchipNumber: [''],
            photo: ['']
        });
    }

    /**
     * Load clients for the selector
     */
    loadClients(): void {
        this.loadingClients = true;
        this.clientService.getClients().subscribe({
            next: (clients) => {
                this.clients = clients;
                this.loadingClients = false;
            },
            error: (error) => {
                console.error('Error loading clients:', error);
                this.loadingClients = false;
                alert('Error al cargar los clientes');
            }
        });
    }

    /**
     * Check if we're in edit mode and load pet data
     */
    checkEditMode(): void {
        this.petId = this.route.snapshot.paramMap.get('id');
        if (this.petId) {
            this.isEditMode = true;
            this.loadPet(this.petId);
        }
    }

    /**
     * Load pet data for editing
     */
    loadPet(id: string): void {
        this.loading = true;
        this.petService.getPetById(id).subscribe({
            next: (pet) => {
                if (pet) {
                    // Convert Timestamp to Date for the datepicker
                    const formData = {
                        ...pet,
                        birthDate: pet.birthDate.toDate()
                    };
                    this.petForm.patchValue(formData);
                }
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading pet:', error);
                this.loading = false;
                alert('Error al cargar la mascota');
                this.router.navigate(['/dashboard/pets']);
            }
        });
    }

    /**
     * Submit the form
     */
    async onSubmit(): Promise<void> {
        if (this.petForm.invalid) {
            this.petForm.markAllAsTouched();
            return;
        }

        this.saving = true;

        try {
            const formValue = this.petForm.value;

            // Convert Date to Timestamp
            const petData: Partial<Pet> = {
                ...formValue,
                birthDate: Timestamp.fromDate(formValue.birthDate)
            };

            if (this.isEditMode && this.petId) {
                await this.petService.updatePet(this.petId, petData);
                alert('Mascota actualizada exitosamente');
            } else {
                await this.petService.createPet(petData);
                alert('Mascota registrada exitosamente');
            }

            if (formValue.clientId) {
                this.router.navigate(['/dashboard/clients', formValue.clientId]);
            } else {
                this.router.navigate(['/dashboard/pets']);
            }
        } catch (error) {
            console.error('Error saving pet:', error);
            alert('Error al guardar la mascota');
        } finally {
            this.saving = false;
        }
    }

    /**
     * Cancel and go back
     */
    onCancel(): void {
        const clientId = this.petForm.get('clientId')?.value || this.route.snapshot.queryParams['clientId'];
        if (clientId) {
            this.router.navigate(['/dashboard/clients', clientId]);
        } else {
            this.router.navigate(['/dashboard/pets']);
        }
    }

    /**
     * Get error message for a field
     */
    getErrorMessage(fieldName: string): string {
        const field = this.petForm.get(fieldName);
        if (!field) return '';

        if (field.hasError('required')) {
            return 'Este campo es requerido';
        }
        if (field.hasError('minlength')) {
            const minLength = field.getError('minlength').requiredLength;
            return `Mínimo ${minLength} caracteres`;
        }
        if (field.hasError('min')) {
            return 'El valor debe ser mayor a 0';
        }
        return '';
    }

    /**
     * Get client display name
     */
    getClientDisplayName(client: Client): string {
        return `${client.firstName} ${client.lastName}`;
    }
}
