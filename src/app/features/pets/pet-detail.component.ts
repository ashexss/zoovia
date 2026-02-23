import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

import { PetService } from '../../core/services/pet.service';
import { ClientService } from '../../core/services/client.service';
import { MedicalRecordService } from '../../core/services/medical-record.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { AuthService } from '../../core/auth/auth.service';
import { Pet, Client, MedicalRecord } from '../../core/models';
import { take } from 'rxjs';

@Component({
    selector: 'app-pet-detail',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        MatProgressSpinnerModule,
        MatTooltipModule
    ],
    templateUrl: './pet-detail.component.html',
    styleUrls: ['./pet-detail.component.scss']
})
export class PetDetailComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private location = inject(Location);
    private petService = inject(PetService);
    private clientService = inject(ClientService);
    private medicalRecordService = inject(MedicalRecordService);
    private appointmentService = inject(AppointmentService);
    private authService = inject(AuthService);
    private cdr = inject(ChangeDetectorRef);
    private snackBar = inject(MatSnackBar);

    petId: string | null = null;
    pet: Pet | null = null;
    owner: Client | null = null;

    // Categorized Medical Records
    medicalRecords: MedicalRecord[] = [];
    consultations: MedicalRecord[] = [];
    vaccinations: MedicalRecord[] = [];
    dewormings: MedicalRecord[] = [];
    treatments: MedicalRecord[] = [];

    loading = false;
    loadingRecords = false;

    // Appointment Context
    hasActiveAppointment = false;
    activeAppointmentId: string | null = null;

    ngOnInit(): void {
        this.petId = this.route.snapshot.paramMap.get('id');
        if (this.petId) {
            this.loadPetData(this.petId);
        }
    }

    loadPetData(id: string): void {
        this.loading = true;
        this.petService.getPetById(id).subscribe({
            next: (pet) => {
                this.pet = pet || null;
                if (pet?.clientId) {
                    this.loadOwnerData(pet.clientId);
                }
                this.loading = false;
                this.cdr.detectChanges();
                this.loadMedicalRecords(id);
                this.checkActiveAppointments(id);
            },
            error: (error) => {
                console.error('[PetDetail] Error loading pet:', error);
                this.loading = false;
                this.cdr.detectChanges();
                this.router.navigate(['/dashboard/pets']);
            }
        });
    }

    loadOwnerData(clientId: string): void {
        this.clientService.getClientById(clientId).subscribe(client => {
            this.owner = client || null;
            this.cdr.detectChanges();
        });
    }

    loadMedicalRecords(petId: string): void {
        this.loadingRecords = true;
        this.medicalRecordService.getRecordsByPet(petId).subscribe({
            next: (records) => {
                this.medicalRecords = records;

                // Categorize records for the different tabs
                this.consultations = records.filter(r => r.type === 'consultation' || r.type === 'checkup' || r.type === 'surgery');
                this.vaccinations = records.filter(r => (r.vaccines && r.vaccines.length > 0));
                this.dewormings = records.filter(r => (r.deworming && r.deworming.length > 0));
                this.treatments = records.filter(r => (r.prescriptions && r.prescriptions.length > 0));

                this.loadingRecords = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('[PetDetail] Error loading records:', err);
                this.loadingRecords = false;
                this.cdr.detectChanges();
            }
        });
    }

    getPetIcon(species?: string): string {
        const icons: Record<string, string> = { dog: 'pets', cat: 'pets', bird: 'flutter_dash', rabbit: 'cruelty_free', other: 'pets' };
        return species ? (icons[species.toLowerCase()] || 'pets') : 'pets';
    }

    formatDate(ts: any): string {
        if (!ts) return '';
        const d = ts?.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    getAge(birthDate: any): string {
        if (!birthDate) return 'Desconocida';
        const d = birthDate?.toDate ? birthDate.toDate() : new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
            age--;
        }
        if (age === 0) {
            const months = (today.getFullYear() - d.getFullYear()) * 12 + today.getMonth() - d.getMonth();
            return `${months} meses`;
        }
        return `${age} años`;
    }

    goBack(): void {
        // Option to go back to previous history state, or directly to client if we know it
        this.location.back();
    }

    editPet(): void {
        if (this.petId) {
            this.router.navigate(['/dashboard/pets', this.petId, 'edit']);
        }
    }

    viewOwner(): void {
        if (this.owner?.id) {
            this.router.navigate(['/dashboard/clients', this.owner.id]);
        }
    }

    newConsultation(): void {
        this.router.navigate(['/dashboard/medical-records/new'], {
            queryParams: {
                petId: this.petId,
                clientId: this.pet?.clientId,
                appointmentId: this.activeAppointmentId
            }
        });
    }

    private checkActiveAppointments(petId: string): void {
        this.authService.currentUser$.pipe(take(1)).subscribe(user => {
            if (!user?.veterinaryId) return;

            this.appointmentService.getTodayAppointments(user.veterinaryId).pipe(take(1)).subscribe({
                next: (appointments: any[]) => { // Using any to avoid importing Appointment model if not exported in index
                    const activeAppt = appointments.find(a => a.petId === petId && a.status === 'in_progress');
                    this.hasActiveAppointment = !!activeAppt;
                    this.activeAppointmentId = activeAppt ? activeAppt.id : null;
                    this.cdr.detectChanges();
                },
                error: (err) => console.error('[PetDetail] Error checking appointments:', err)
            });
        });
    }

    viewRecord(recordId: string): void {
        this.router.navigate(['/dashboard/records', recordId, 'edit']);
    }
}
