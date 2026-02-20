import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDividerModule } from '@angular/material/divider';

import { debounceTime, distinctUntilChanged, switchMap, startWith, map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { VeterinaryService } from '../../core/services/veterinary.service';
import { ClientService } from '../../core/services/client.service';
import { PetService } from '../../core/services/pet.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { Veterinary, Client, Pet } from '../../core/models';

@Component({
    selector: 'app-appointment-form',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule,
        MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
        MatButtonModule, MatIconModule, MatRadioModule,
        MatProgressSpinnerModule, MatDatepickerModule, MatNativeDateModule,
        MatSnackBarModule, MatAutocompleteModule, MatDividerModule
    ],
    templateUrl: './appointment-form.component.html',
    styleUrls: ['./appointment-form.component.scss']
})
export class AppointmentFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private authService = inject(AuthService);
    private vetService = inject(VeterinaryService);
    private clientService = inject(ClientService);
    private petService = inject(PetService);
    private appointmentService = inject(AppointmentService);
    private snackBar = inject(MatSnackBar);

    form!: FormGroup;
    saving = false;
    veterinary?: Veterinary;
    userId = '';

    // Client autocomplete
    allClients: Client[] = [];
    filteredClients$: Observable<Client[]> = of([]);
    selectedClient?: Client;

    // Pets for selected client
    clientPets: Pet[] = [];
    loadingPets = false;

    // Time slots (for pre-scheduled)
    timeSlots: string[] = [];

    // Min date for date picker
    minDate = new Date();

    ngOnInit() {
        this.form = this.fb.group({
            appointmentType: ['walk_in', Validators.required],
            clientSearch: [''],
            clientId: ['', Validators.required],
            petId: ['', Validators.required],
            reason: ['', [Validators.required, Validators.minLength(3)]],
            notes: [''],
            priority: ['normal', Validators.required],
            // Pre-scheduled only
            appointmentDate: [null],
            scheduledTime: ['']
        });

        this.authService.currentUser$.subscribe(user => {
            this.userId = user?.id ?? '';
        });

        this.vetService.getCurrentVeterinary().subscribe(vet => {
            this.veterinary = vet;
            this.generateSlots();
        });

        // Pre-load clients for autocomplete
        this.vetService.getCurrentVeterinary().subscribe(vet => {
            if (!vet) return;
            this.clientService.getClients().subscribe(clients => {
                this.allClients = clients;
            });
        });

        // Wire client search
        this.filteredClients$ = this.form.get('clientSearch')!.valueChanges.pipe(
            startWith(''),
            debounceTime(200),
            distinctUntilChanged(),
            map(value => this.filterClients(typeof value === 'string' ? value : ''))
        );

        // React to appointmentType changes
        this.form.get('appointmentType')!.valueChanges.subscribe(type => {
            const dateCtrl = this.form.get('appointmentDate')!;
            const timeCtrl = this.form.get('scheduledTime')!;
            if (type === 'scheduled') {
                dateCtrl.setValidators(Validators.required);
                timeCtrl.setValidators(Validators.required);
            } else {
                dateCtrl.clearValidators();
                timeCtrl.clearValidators();
            }
            dateCtrl.updateValueAndValidity();
            timeCtrl.updateValueAndValidity();
        });
    }

    // ─── Client ─────────────────────────────────────────────────────────────────

    filterClients(value: string): Client[] {
        if (!value.trim()) return this.allClients.slice(0, 10);
        const lower = value.toLowerCase();
        return this.allClients.filter(c =>
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(lower) ||
            c.phone?.includes(lower)
        ).slice(0, 10);
    }

    displayClient(client: Client | null): string {
        if (!client) return '';
        return `${client.firstName} ${client.lastName}`;
    }

    onClientSelected(client: Client) {
        this.selectedClient = client;
        this.form.patchValue({ clientId: client.id, petId: '' });
        this.loadPets(client.id);
    }

    loadPets(clientId: string) {
        this.loadingPets = true;
        this.petService.getPetsByClient(clientId).subscribe(pets => {
            this.clientPets = pets;
            this.loadingPets = false;
        });
    }

    // ─── Time Slots ──────────────────────────────────────────────────────────────

    generateSlots() {
        const settings = this.veterinary?.appointmentSettings;
        const interval = settings?.slotInterval ?? 30;
        // Default to 8am-8pm if no business hours configured
        this.timeSlots = this.appointmentService.generateTimeSlots('08:00', '20:00', interval);
    }

    get isScheduledType(): boolean {
        return this.form.get('appointmentType')?.value === 'scheduled';
    }

    get appointmentMode(): string {
        return this.veterinary?.appointmentSettings?.mode ?? 'both';
    }

    get showTypeSelector(): boolean {
        return this.appointmentMode === 'both';
    }

    // ─── Submit ─────────────────────────────────────────────────────────────────

    async submit() {
        if (this.form.invalid || !this.veterinary) return;
        this.saving = true;

        const v = this.form.value;
        const isWalkIn = v.appointmentType === 'walk_in';
        const client = this.selectedClient!;
        const pet = this.clientPets.find(p => p.id === v.petId)!;

        try {
            if (isWalkIn) {
                await this.appointmentService.registerWalkIn({
                    veterinaryId: this.veterinary.id,
                    clientId: client.id,
                    clientName: `${client.firstName} ${client.lastName}`,
                    petId: pet.id,
                    petName: pet.name,
                    petSpecies: pet.species,
                    reason: v.reason,
                    notes: v.notes || undefined,
                    priority: v.priority,
                    createdBy: this.userId
                });
                this.snackBar.open(`Walk-in registrado: ${pet.name}`, 'OK', { duration: 3000 });
            } else {
                const date = v.appointmentDate as Date;
                await this.appointmentService.create({
                    veterinaryId: this.veterinary.id,
                    clientId: client.id,
                    clientName: `${client.firstName} ${client.lastName}`,
                    petId: pet.id,
                    petName: pet.name,
                    petSpecies: pet.species,
                    date: this.appointmentService.toDateString(date),
                    scheduledTime: v.scheduledTime,
                    reason: v.reason,
                    notes: v.notes || undefined,
                    isWalkIn: false,
                    priority: v.priority,
                    status: 'scheduled',
                    createdBy: this.userId
                });
                this.snackBar.open(`Turno agendado para ${pet.name}`, 'OK', { duration: 3000 });
            }
            this.router.navigate(['/dashboard/appointments']);
        } catch (e) {
            console.error(e);
            this.snackBar.open('Error al guardar el turno', 'Cerrar', { duration: 3000 });
        } finally {
            this.saving = false;
        }
    }

    cancel() {
        this.router.navigate(['/dashboard/appointments']);
    }

    getPetLabel(pet: Pet): string {
        const age = this.getPetAge(pet);
        return `${pet.name} (${pet.species === 'dog' ? 'Perro' : pet.species === 'cat' ? 'Gato' : pet.species}${age ? ', ' + age : ''})`;
    }

    getPetAge(pet: Pet): string {
        if (!pet.birthDate) return '';
        const birth = pet.birthDate.toDate ? pet.birthDate.toDate() : new Date(pet.birthDate as any);
        const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 86400000));
        return years > 0 ? `${years} años` : 'cachorro';
    }
}
