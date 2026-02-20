import { Injectable, inject } from '@angular/core';
import {
    Firestore,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp
} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { VeterinaryService } from './veterinary.service';
import { LoyaltyService, DEFAULT_LOYALTY_PROGRAM } from './loyalty.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppointmentStatus =
    | 'scheduled'
    | 'waiting'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show';

export interface Appointment {
    id: string;
    veterinaryId: string;
    clientId: string;
    petId: string;
    clientName: string;
    petName: string;
    petSpecies?: string;
    createdBy: string;
    date: string;
    scheduledTime?: string;
    arrivalTime?: string;
    startTime?: string;
    endTime?: string;
    reason: string;
    notes?: string;
    isWalkIn: boolean;
    priority: 'normal' | 'urgent';
    status: AppointmentStatus;
    /** Set to true once loyalty points have been awarded for this visit */
    loyaltyAwarded?: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type CreateAppointmentDto = Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AppointmentService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);
    private vetService = inject(VeterinaryService);
    private loyaltyService = inject(LoyaltyService);

    private col() {
        return collection(this.firestore, 'appointments');
    }


    /** Get all appointments for a vet on a specific date (YYYY-MM-DD) */
    getByDate(veterinaryId: string, date: string): Observable<Appointment[]> {
        const q = query(
            this.col(),
            where('veterinaryId', '==', veterinaryId),
            where('date', '==', date),
            orderBy('scheduledTime'),
            orderBy('createdAt')
        );
        return from(getDocs(q)).pipe(
            map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))
        );
    }

    /** Get today's appointments */
    getTodayAppointments(veterinaryId: string): Observable<Appointment[]> {
        const today = this.toDateString(new Date());
        return this.getByDate(veterinaryId, today);
    }

    /** Get a single appointment */
    getById(id: string): Observable<Appointment | undefined> {
        const ref = doc(this.firestore, 'appointments', id);
        return from(getDoc(ref)).pipe(
            map(snap => snap.exists() ? { id: snap.id, ...snap.data() } as Appointment : undefined)
        );
    }

    /** Create a new appointment (walk-in or pre-scheduled) */
    async create(data: CreateAppointmentDto): Promise<Appointment> {
        const now = Timestamp.now();
        const payload = { ...data, createdAt: now, updatedAt: now };
        const ref = await addDoc(this.col(), payload);
        return { id: ref.id, ...payload };
    }

    /** Quick walk-in registration — minimal data needed */
    async registerWalkIn(params: {
        veterinaryId: string;
        clientId: string;
        clientName: string;
        petId: string;
        petName: string;
        petSpecies?: string;
        reason: string;
        notes?: string;
        priority?: 'normal' | 'urgent';
        createdBy: string;
    }): Promise<Appointment> {
        return this.create({
            ...params,
            date: this.toDateString(new Date()),
            arrivalTime: this.toTimeString(new Date()),
            isWalkIn: true,
            priority: params.priority ?? 'normal',
            status: 'waiting'
        });
    }

    /** Update appointment status, optionally recording the time.
     *  When status → completed, automatically awards loyalty points if program is enabled. */
    async updateStatus(id: string, status: AppointmentStatus): Promise<void> {
        const ref = doc(this.firestore, 'appointments', id);
        const timeFields: Partial<Appointment> = {};

        if (status === 'waiting') {
            timeFields.arrivalTime = this.toTimeString(new Date());
        } else if (status === 'in_progress') {
            timeFields.startTime = this.toTimeString(new Date());
        } else if (status === 'completed') {
            timeFields.endTime = this.toTimeString(new Date());
        }

        await updateDoc(ref, { status, ...timeFields, updatedAt: Timestamp.now() });

        // Auto-award loyalty points on completion
        if (status === 'completed') {
            try {
                const snap = await getDoc(ref);
                if (!snap.exists()) return;
                const appt = { id: snap.id, ...snap.data() } as Appointment;
                if (appt.loyaltyAwarded) return; // prevent double-award

                // Get vet loyalty program config
                const vet = await new Promise<any>((resolve) =>
                    this.vetService.getCurrentVeterinary().subscribe(resolve)
                );
                const program = vet?.loyaltyProgram ?? DEFAULT_LOYALTY_PROGRAM;
                if (!program.enabled) return;

                // Get client's current balance
                const clientRef = doc(this.firestore, 'clients', appt.clientId);
                const clientSnap = await getDoc(clientRef);
                const currentBalance = (clientSnap.data() as any)?.loyaltyPoints ?? 0;

                await this.loyaltyService.awardVisitPoints({
                    veterinaryId: appt.veterinaryId,
                    clientId: appt.clientId,
                    clientName: appt.clientName,
                    currentBalance,
                    appointmentId: id,
                    petName: appt.petName,
                    createdBy: appt.createdBy,
                    program
                });

                // Mark as awarded to avoid duplicates
                await updateDoc(ref, { loyaltyAwarded: true });
            } catch (e) {
                // Non-blocking — points can be manually adjusted later
                console.warn('[AppointmentService] Could not auto-award loyalty points:', e);
            }
        }
    }

    /** Partial update */
    async update(id: string, data: Partial<Appointment>): Promise<void> {
        const ref = doc(this.firestore, 'appointments', id);
        await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
    }

    /** Cancel appointment */
    async cancel(id: string): Promise<void> {
        return this.updateStatus(id, 'cancelled');
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    toDateString(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    toTimeString(date: Date): string {
        return date.toTimeString().slice(0, 5);
    }

    /** Generate time slots (HH:mm) for pre-scheduling */
    generateTimeSlots(openTime: string, closeTime: string, intervalMinutes: number): string[] {
        const slots: string[] = [];
        const [openH, openM] = openTime.split(':').map(Number);
        const [closeH, closeM] = closeTime.split(':').map(Number);
        let minutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        while (minutes < closeMinutes) {
            const h = Math.floor(minutes / 60).toString().padStart(2, '0');
            const m = (minutes % 60).toString().padStart(2, '0');
            slots.push(`${h}:${m}`);
            minutes += intervalMinutes;
        }
        return slots;
    }

    /** Get status label in Spanish */
    getStatusLabel(status: AppointmentStatus): string {
        const labels: Record<AppointmentStatus, string> = {
            scheduled: 'Agendado',
            waiting: 'Esperando',
            in_progress: 'En atención',
            completed: 'Atendido',
            cancelled: 'Cancelado',
            no_show: 'No se presentó'
        };
        return labels[status];
    }

    /** Get status color class */
    getStatusColor(status: AppointmentStatus): string {
        const colors: Record<AppointmentStatus, string> = {
            scheduled: 'scheduled',
            waiting: 'waiting',
            in_progress: 'in-progress',
            completed: 'completed',
            cancelled: 'cancelled',
            no_show: 'no-show'
        };
        return colors[status];
    }
}
