import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Subject, takeUntil } from 'rxjs';
import { VeterinaryService } from '../../core/services/veterinary.service';
import { AppointmentService, Appointment, AppointmentStatus } from '../../core/services/appointment.service';

@Component({
    selector: 'app-appointments-list',
    standalone: true,
    imports: [
        CommonModule, RouterModule, MatCardModule, MatButtonModule,
        MatIconModule, MatChipsModule, MatDividerModule,
        MatProgressSpinnerModule, MatTooltipModule, MatMenuModule,
        MatBadgeModule, MatSnackBarModule
    ],
    templateUrl: './appointments-list.component.html',
    styleUrls: ['./appointments-list.component.scss']
})
export class AppointmentsListComponent implements OnInit, OnDestroy {
    private vetService = inject(VeterinaryService);
    private appointmentService = inject(AppointmentService);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private destroy$ = new Subject<void>();

    veterinaryId = '';
    currentDate = new Date();
    appointments: Appointment[] = [];
    loading = false;
    selectedAppointment: Appointment | null = null;

    // ─── Lifecycle ─────────────────────────────────────────────────────────────

    ngOnInit() {
        this.vetService.getCurrentVeterinary().pipe(takeUntil(this.destroy$)).subscribe(vet => {
            if (vet) {
                this.veterinaryId = vet.id;
                this.loadAppointments();
            }
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ─── Data ──────────────────────────────────────────────────────────────────

    loadAppointments() {
        this.loading = true;
        const dateStr = this.appointmentService.toDateString(this.currentDate);
        this.appointmentService.getByDate(this.veterinaryId, dateStr)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (appts) => {
                    this.appointments = appts;
                    this.loading = false;
                },
                error: () => {
                    this.loading = false;
                    this.snackBar.open('Error al cargar los turnos', 'Cerrar', { duration: 3000 });
                }
            });
    }

    // ─── Date Navigation ───────────────────────────────────────────────────────

    goToPreviousDay() {
        this.currentDate = new Date(this.currentDate);
        this.currentDate.setDate(this.currentDate.getDate() - 1);
        this.loadAppointments();
    }

    goToNextDay() {
        this.currentDate = new Date(this.currentDate);
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        this.loadAppointments();
    }

    goToToday() {
        this.currentDate = new Date();
        this.loadAppointments();
    }

    get isToday(): boolean {
        const today = new Date();
        return this.currentDate.toDateString() === today.toDateString();
    }

    get formattedDate(): string {
        return this.currentDate.toLocaleDateString('es-AR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    // ─── Grouped Appointments ──────────────────────────────────────────────────

    get waiting(): Appointment[] {
        return this.appointments.filter(a => a.status === 'waiting');
    }

    get inProgress(): Appointment[] {
        return this.appointments.filter(a => a.status === 'in_progress');
    }

    get scheduled(): Appointment[] {
        return this.appointments.filter(a => a.status === 'scheduled');
    }

    get completed(): Appointment[] {
        return this.appointments.filter(a => a.status === 'completed');
    }

    get cancelled(): Appointment[] {
        return this.appointments.filter(a => ['cancelled', 'no_show'].includes(a.status));
    }

    get activeCount(): number {
        return this.waiting.length + this.inProgress.length + this.scheduled.length;
    }

    // ─── Panel ─────────────────────────────────────────────────────────────────

    selectAppointment(a: Appointment) {
        this.selectedAppointment = this.selectedAppointment?.id === a.id ? null : a;
    }

    closePanel() {
        this.selectedAppointment = null;
    }

    // ─── Status Actions ────────────────────────────────────────────────────────

    async markWaiting(a: Appointment) {
        await this.appointmentService.updateStatus(a.id, 'waiting');
        this.loadAppointments();
        this.snackBar.open(`${a.petName} está esperando`, 'OK', { duration: 2000 });
    }

    async markInProgress(a: Appointment) {
        await this.appointmentService.updateStatus(a.id, 'in_progress');
        this.loadAppointments();
        this.snackBar.open(`Atendiendo a ${a.petName}...`, 'OK', { duration: 2000 });
    }

    async markCompleted(a: Appointment) {
        await this.appointmentService.updateStatus(a.id, 'completed');
        if (this.selectedAppointment?.id === a.id) this.selectedAppointment = null;
        this.loadAppointments();
        this.snackBar.open(`Turno de ${a.petName} finalizado`, 'OK', { duration: 2500 });
    }

    async markCancelled(a: Appointment) {
        await this.appointmentService.updateStatus(a.id, 'cancelled');
        if (this.selectedAppointment?.id === a.id) this.selectedAppointment = null;
        this.loadAppointments();
    }

    async markNoShow(a: Appointment) {
        await this.appointmentService.updateStatus(a.id, 'no_show');
        this.loadAppointments();
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    getStatusLabel(s: AppointmentStatus): string {
        return this.appointmentService.getStatusLabel(s);
    }

    getStatusClass(s: AppointmentStatus): string {
        return this.appointmentService.getStatusColor(s);
    }

    getPetIcon(species?: string): string {
        if (species === 'dog') return '🐕';
        if (species === 'cat') return '🐈';
        if (species === 'bird') return '🦜';
        if (species === 'rabbit') return '🐇';
        return '🐾';
    }

    navigateToMedicalRecord(appointment: Appointment) {
        this.router.navigate(['/dashboard/medical-records'], {
            queryParams: { petId: appointment.petId, clientId: appointment.clientId }
        });
    }

    trackById(_: number, a: Appointment) { return a.id; }
}
