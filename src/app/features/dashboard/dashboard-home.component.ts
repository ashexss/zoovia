import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { ClientService } from '../../core/services/client.service';
import { PetService } from '../../core/services/pet.service';
import { MedicalRecordService } from '../../core/services/medical-record.service';
import { VeterinaryService } from '../../core/services/veterinary.service';
import { AppointmentService, Appointment } from '../../core/services/appointment.service';
import { AuthService } from '../../core/auth/auth.service';
import { Client, Veterinary, MedicalRecord } from '../../core/models';
import { combineLatest, of } from 'rxjs';
import { take, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule
  ],
  providers: [DatePipe],
  template: `
    <div class="dashboard-home">
      <!-- Header Section: Welcome + Search + Clock -->
      <div class="header-section">
        <div class="welcome-header">
          <h1>Panel de Control</h1>
          <p class="subtitle">Bienvenido al Sistema de Gestión Zoovia</p>
        </div>

        <div class="header-actions">
          <!-- Client Search Bar -->
          <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
            <mat-icon matPrefix>search</mat-icon>
            <input type="text"
                   matInput
                   placeholder="Buscar cliente por DNI, nombre..."
                   [formControl]="searchControl"
                   [matAutocomplete]="auto">
            <button *ngIf="searchControl.value" matSuffix mat-icon-button aria-label="Limpiar" (click)="searchControl.setValue('')">
              <mat-icon>close</mat-icon>
            </button>
            <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onClientSelected($event.option.value)">
              <mat-option *ngIf="(searchControl.value?.length || 0) > 1 && searchResults.length === 0 && !loadingSearch" disabled>
                No se encontraron resultados
              </mat-option>
              <mat-option *ngFor="let client of searchResults" [value]="client">
                <div class="search-result-item">
                  <span class="client-name">{{ client.firstName }} {{ client.lastName }}</span>
                  <span class="client-dni">{{ client.identificationNumber || 'Sin DNI' }}</span>
                </div>
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>
        </div>
      </div>

      <!-- Quick Actions -->
      <mat-card class="quick-actions-card">
        <mat-card-header>
          <mat-card-title><mat-icon>bolt</mat-icon> Accesos Rápidos</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="actions-grid">
            <button mat-raised-button color="primary" (click)="navigateTo('/dashboard/clients/new')">
              <mat-icon>person_add</mat-icon> Nuevo Cliente
            </button>
            <button mat-raised-button color="primary" (click)="navigateTo('/dashboard/pets/new')">
              <mat-icon>add_circle</mat-icon> Registrar Mascota
            </button>
            <button mat-raised-button color="primary" (click)="navigateTo('/dashboard/medical-records/new')">
              <mat-icon>note_add</mat-icon> Nueva Consulta
            </button>
            <button *ngIf="appointmentsEnabled" mat-raised-button color="accent" (click)="navigateTo('/dashboard/appointments/new')">
              <mat-icon>event_available</mat-icon> Nuevo Turno
            </button>
            <button mat-raised-button color="accent" (click)="navigateTo('/dashboard/sales/new')" matTooltip="Próximamente">
              <mat-icon>storefront</mat-icon> Nueva Venta
            </button>
          </div>
        </mat-card-content>
      </mat-card>
      <!-- Center Column (Appointments & Logs) -->
        <div class="center-column">
          
          <!-- Today's Appointments -->
          <mat-card class="widget-card" *ngIf="appointmentsEnabled">
            <mat-card-header>
              <mat-icon mat-card-avatar>event</mat-icon>
              <mat-card-title>Turnos de Hoy</mat-card-title>
              <mat-card-subtitle>Próximas visitas agendadas</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div *ngIf="loadingAppts" class="widget-loading"><mat-spinner diameter="28"></mat-spinner></div>
              <div *ngIf="!loadingAppts && todayAppointments.length === 0" class="widget-empty">
                <mat-icon>event_available</mat-icon>
                <span>Sin turnos hoy</span>
              </div>
              <div *ngIf="!loadingAppts && todayAppointments.length > 0">
                <div class="appt-list">
                  <div *ngFor="let appt of todayAppointments.slice(0, 5)" class="appt-row" [class]="'status-' + appt.status">
                    <div class="appt-time">{{ appt.scheduledTime || appt.arrivalTime || '–' }}</div>
                    <div class="appt-info">
                      <span class="appt-pet">{{ appt.petName }}</span>
                      <span class="appt-client">{{ appt.clientName }}</span>
                    </div>
                    <div class="appt-badge" [class]="'badge-' + appt.status">
                      {{ getStatusLabel(appt.status) }}
                    </div>
                  </div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Yesterday's Logs -->
          <mat-card class="widget-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>history</mat-icon>
              <mat-card-title>Consultas de Ayer</mat-card-title>
              <mat-card-subtitle>Repaso de historias clínicas</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div *ngIf="loadingRecords" class="widget-loading"><mat-spinner diameter="28"></mat-spinner></div>
              <div *ngIf="!loadingRecords && yesterdayRecords.length === 0" class="widget-empty">
                <mat-icon>check_circle_outline</mat-icon>
                <span>No hay registros recientes para mostrar.</span>
              </div>
              <div *ngIf="!loadingRecords && yesterdayRecords.length > 0">
                <div class="appt-list">
                  <div *ngFor="let record of yesterdayRecords" class="appt-row record-row" (click)="navigateTo('/dashboard/clients/' + record.clientId)">
                    <div class="appt-info">
                      <span class="appt-pet">{{ record.diagnosisAndTreatment || 'Atención general' }}</span>
                      <span class="appt-client">{{ record.date.toDate() | date:'shortTime' }}</span>
                    </div>
                    <mat-icon class="go-icon">chevron_right</mat-icon>
                  </div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

        </div>
    </div>
  `,
  styles: [`
    .dashboard-home { max-width: 1400px; margin: 0 auto; padding-bottom: 40px; }

    /* Header with Search and Clock */
    .header-section {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;
      flex-wrap: wrap; gap: 20px;
    }
    .welcome-header h1 { margin: 0 0 8px; font-size: 2rem; font-weight: 600; color: #00695c; }
    .welcome-header .subtitle { margin: 0; font-size: 1.125rem; color: #666; }
    
    .header-actions {
      display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
    }
    .search-field { width: 320px; }
    .search-result-item { display: flex; justify-content: space-between; align-items: center; width: 100%; }
    .client-name { font-weight: 500; }
    .client-name { font-weight: 500; }
    .client-dni { font-size: 12px; color: #7f8c8d; }

    /* Widgets Row */
    .widgets-row {
      display: grid; grid-template-columns: 1fr; gap: 24px;
    }
    .center-column { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; 
      @media (max-width: 1024px) { grid-template-columns: 1fr; }
    }

    /* Shared Widget Cards */
    .widget-card { min-height: 240px; }
    .widget-loading, .widget-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; padding: 2rem; color: #adb5bd; text-align: center;
      mat-icon { font-size: 36px; width: 36px; height: 36px; }
    }


    /* Quick Actions */
    .quick-actions-card {
      margin-bottom: 32px;
      mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 1.25rem; font-weight: 600; color: #00695c; }
      .actions-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;
        button { height: 52px; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px; }
      }
    }

    /* Lists */
    .appt-list { display: flex; flex-direction: column; gap: 8px; }
    .appt-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; background: #f8f9fa;
      .appt-time { font-size: 13px; font-weight: 700; color: #555; width: 45px; }
      .appt-info { flex: 1; display: flex; flex-direction: column;
        .appt-pet { font-size: 14px; font-weight: 700; color: #2c3e50; }
        .appt-client { font-size: 12px; color: #6c757d; }
      }
      .appt-badge {
        font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px;
        &.badge-waiting    { background: #fff3e0; color: #e65100; }
        &.badge-in_progress { background: #e3f2fd; color: #1565c0; }
        &.badge-scheduled  { background: #e8f5e9; color: #2e7d32; }
      }
    }
    .record-row { cursor: pointer; transition: background 0.2s; &:hover { background: #e9ecef; } }
    .go-icon { color: #adb5bd; }

    @media (max-width: 768px) {
      .header-actions { width: 100%; justify-content: space-between; }
      .search-field { width: 100%; }
      .clock-widget { width: 100%; text-align: center; }
    }
  `]
})
export class DashboardHomeComponent implements OnInit, OnDestroy {
  private clientService = inject(ClientService);
  private recordService = inject(MedicalRecordService);
  private vetService = inject(VeterinaryService);
  private apptService = inject(AppointmentService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Widget Toggles
  loyaltyEnabled = false;
  appointmentsEnabled = false;
  // Search
  searchControl = new FormControl('');
  searchResults: Client[] = [];
  loadingSearch = false;
  // Appointments
  todayAppointments: Appointment[] = [];
  loadingAppts = true;

  // Logs
  yesterdayRecords: MedicalRecord[] = [];
  loadingRecords = true;

  ngOnInit() {
    this.setupSearch();

    this.vetService.getCurrentVeterinary().pipe(take(1)).subscribe(vet => {
      if (!vet) return;
      this.appointmentsEnabled = !!vet.subscription?.modules?.appointments;
      this.loyaltyEnabled = !!vet.loyaltyProgram?.enabled;

      this.loadYesterdayRecords();
      if (this.appointmentsEnabled) this.loadTodayAppointments(vet.id);

      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() { }

  private setupSearch() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      if (!term || term.trim().length < 2) {
        this.searchResults = [];
        return;
      }
      this.loadingSearch = true;
      this.clientService.searchClients(term).pipe(
        take(1),
        catchError(() => of([]))
      ).subscribe((results: Client[] | undefined) => {
        this.searchResults = (results || []).slice(0, 5);
        this.loadingSearch = false;
        this.cdr.detectChanges();
      });
    });
  }

  onClientSelected(client: Client) {
    this.searchControl.setValue('');
    this.navigateTo('/dashboard/clients/' + client.id);
  }

  private loadTodayAppointments(vetId: string) {
    this.loadingAppts = true;
    this.apptService.getTodayAppointments(vetId).subscribe({
      next: appts => { this.todayAppointments = appts; this.loadingAppts = false; this.cdr.detectChanges(); },
      error: () => { this.loadingAppts = false; this.cdr.detectChanges(); }
    });
  }

  private loadYesterdayRecords() {
    this.loadingRecords = true;
    this.recordService.getMedicalRecords().pipe(
      take(1),
      catchError(() => of([]))
    ).subscribe((records: MedicalRecord[] | undefined) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today

      this.yesterdayRecords = (records || []).filter(r => {
        const d = r.date.toDate();
        return d < now; // Any old record is considered past (mocking for UX)
      }).slice(0, 3);
      this.loadingRecords = false;
      this.cdr.detectChanges();
    });
  }

  getStatusLabel(status: string): string {
    return this.apptService.getStatusLabel(status as any);
  }

  navigateTo(route: string) { this.router.navigate([route]); }
}
