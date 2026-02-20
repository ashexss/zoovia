import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { ClientService } from '../../core/services/client.service';
import { PetService } from '../../core/services/pet.service';
import { MedicalRecordService } from '../../core/services/medical-record.service';
import { VeterinaryService } from '../../core/services/veterinary.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { AuthService } from '../../core/auth/auth.service';
import { Client } from '../../core/models';
import { Appointment } from '../../core/services/appointment.service';
import { take } from 'rxjs';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatChipsModule],
  template: `
    <div class="dashboard-home">
      <div class="welcome-header">
        <h1>Panel de Control</h1>
        <p class="subtitle">Bienvenido al Sistema de Gestión Zoovia</p>
      </div>

      <!-- Statistics Cards -->
      <div class="stats-grid">
        <mat-card class="stat-card clients">
          <mat-card-content>
            <div class="stat-icon"><mat-icon>people</mat-icon></div>
            <div class="stat-info">
              <h3>Clientes</h3>
              <p class="stat-number">{{ clientsCount }}</p>
              <p class="stat-label">Registrados</p>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card pets">
          <mat-card-content>
            <div class="stat-icon"><mat-icon>pets</mat-icon></div>
            <div class="stat-info">
              <h3>Mascotas</h3>
              <p class="stat-number">{{ petsCount }}</p>
              <p class="stat-label">En sistema</p>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card records">
          <mat-card-content>
            <div class="stat-icon"><mat-icon>medical_services</mat-icon></div>
            <div class="stat-info">
              <h3>Historiales</h3>
              <p class="stat-number">{{ recordsCount }}</p>
              <p class="stat-label">Consultas totales</p>
            </div>
          </mat-card-content>
        </mat-card>

        @if (loyaltyEnabled) {
        <mat-card class="stat-card loyalty">
          <mat-card-content>
            <div class="stat-icon"><mat-icon>stars</mat-icon></div>
            <div class="stat-info">
              <h3>Puntos emitidos</h3>
              <p class="stat-number">{{ totalLoyaltyPoints | number }}</p>
              <p class="stat-label">En programa de fidelización</p>
            </div>
          </mat-card-content>
        </mat-card>
        }
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
            @if (appointmentsEnabled) {
            <button mat-raised-button color="accent" (click)="navigateTo('/dashboard/appointments/new')">
              <mat-icon>event_available</mat-icon> Nuevo Turno
            </button>
            }
            <button mat-raised-button (click)="navigateTo('/dashboard/clients')">
              <mat-icon>search</mat-icon> Buscar Cliente
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Two-column row: Appointments + Loyalty -->
      <div class="widgets-row">

        <!-- Today's Appointments Widget -->
        @if (appointmentsEnabled) {
        <mat-card class="widget-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>event</mat-icon>
            <mat-card-title>Turnos de Hoy</mat-card-title>
            <mat-card-subtitle>{{ todayLabel }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @if (loadingAppts) {
              <div class="widget-loading"><mat-spinner diameter="28"></mat-spinner></div>
            }
            @if (!loadingAppts && todayAppointments.length === 0) {
              <div class="widget-empty">
                <mat-icon>event_available</mat-icon>
                <span>Sin turnos hoy</span>
                <button mat-stroked-button (click)="navigateTo('/dashboard/appointments/new')">+ Agregar turno</button>
              </div>
            }
            @if (!loadingAppts && todayAppointments.length > 0) {
              <div class="appt-summary">
                <div class="appt-chip waiting">
                  <mat-icon>schedule</mat-icon>
                  {{ waitingCount }} esperando
                </div>
                <div class="appt-chip in-progress">
                  <mat-icon>medical_services</mat-icon>
                  {{ inProgressCount }} en atención
                </div>
                <div class="appt-chip scheduled">
                  <mat-icon>event</mat-icon>
                  {{ scheduledCount }} agendados
                </div>
              </div>
              <div class="appt-list">
                @for (appt of todayAppointments.slice(0, 5); track appt.id) {
                <div class="appt-row" [class]="'status-' + appt.status">
                  <div class="appt-time">{{ appt.scheduledTime ?? appt.arrivalTime ?? '–' }}</div>
                  <div class="appt-info">
                    <span class="appt-pet">{{ appt.petName }}</span>
                    <span class="appt-client">{{ appt.clientName }}</span>
                  </div>
                  <div class="appt-badge" [class]="'badge-' + appt.status">
                    {{ getStatusLabel(appt.status) }}
                  </div>
                </div>
                }
              </div>
              <div class="widget-footer">
                <button mat-button color="primary" (click)="navigateTo('/dashboard/appointments')">
                  Ver agenda completa <mat-icon>arrow_forward</mat-icon>
                </button>
              </div>
            }
          </mat-card-content>
        </mat-card>
        }

        <!-- Loyalty Widget -->
        @if (loyaltyEnabled) {
        <mat-card class="widget-card loyalty-widget">
          <mat-card-header>
            <mat-icon mat-card-avatar>workspace_premium</mat-icon>
            <mat-card-title>Fidelización</mat-card-title>
            <mat-card-subtitle>Clientes con más puntos</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @if (loadingLoyalty) {
              <div class="widget-loading"><mat-spinner diameter="28"></mat-spinner></div>
            }
            @if (!loadingLoyalty && topClients.length === 0) {
              <div class="widget-empty">
                <mat-icon>stars</mat-icon>
                <span>Sin puntos emitidos aún. Se acumulan al finalizar cada consulta.</span>
              </div>
            }
            @if (!loadingLoyalty && topClients.length > 0) {
              <div class="loyalty-list">
                @for (client of topClients; track client.id; let i = $index) {
                <div class="loyalty-row" (click)="navigateTo('/dashboard/clients/' + client.id)">
                  <div class="loyalty-rank">{{ i + 1 }}</div>
                  <div class="loyalty-avatar">{{ getInitials(client) }}</div>
                  <div class="loyalty-info">
                    <span class="loyalty-name">{{ client.firstName }} {{ client.lastName }}</span>
                    <span class="loyalty-tier" [class]="'tier-' + (client.loyalty?.tier ?? 'bronze')">
                      {{ getTierLabel(client.loyalty?.tier ?? 'bronze') }}
                    </span>
                  </div>
                  <div class="loyalty-pts">
                    <span class="pts">{{ client.loyaltyPoints | number }}</span>
                    <span class="pts-label">pts</span>
                  </div>
                </div>
                }
              </div>
              <div class="widget-footer">
                <button mat-button color="primary" (click)="navigateTo('/dashboard/clients')">
                  Ver clientes <mat-icon>arrow_forward</mat-icon>
                </button>
              </div>
            }
          </mat-card-content>
        </mat-card>
        }

      </div>

      <!-- Getting Started Guide (only show if no data) -->
      <mat-card class="welcome-card" *ngIf="clientsCount === 0">
        <mat-card-header>
          <mat-card-title><mat-icon>rocket_launch</mat-icon> Primeros Pasos</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="intro-text">¡Comienza a usar el sistema en 3 simples pasos!</p>
          <div class="steps">
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-content">
                <h4>Registra un Cliente</h4>
                <p>Crea el perfil del dueño de la mascota con sus datos de contacto.</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">2</div>
              <div class="step-content">
                <h4>Agrega una Mascota</h4>
                <p>Registra la mascota asociándola con su dueño.</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">3</div>
              <div class="step-content">
                <h4>Crea el Historial</h4>
                <p>Comienza a registrar consultas, diagnósticos y tratamientos.</p>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .dashboard-home { max-width: 1400px; margin: 0 auto; }

    .welcome-header {
      margin-bottom: 32px;
      h1 { margin: 0 0 8px; font-size: 2rem; font-weight: 600; color: #00695c; }
      .subtitle { margin: 0; font-size: 1.125rem; color: #666; }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .stat-card {
      transition: all 0.3s ease;
      cursor: default;
      &:hover { transform: translateY(-4px); box-shadow: 0 6px 16px rgba(0,0,0,.15); }
      mat-card-content { display: flex; align-items: center; gap: 20px; padding: 24px !important; }
      .stat-icon {
        background: linear-gradient(135deg, #00897b, #00695c);
        border-radius: 16px; padding: 16px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 12px rgba(0,137,123,.3);
        mat-icon { color: white; font-size: 36px; width: 36px; height: 36px; }
      }
      &.pets .stat-icon { background: linear-gradient(135deg, #ff6f00, #e65100); box-shadow: 0 4px 12px rgba(255,111,0,.3); }
      &.records .stat-icon { background: linear-gradient(135deg, #1976d2, #0d47a1); box-shadow: 0 4px 12px rgba(25,118,210,.3); }
      &.loyalty .stat-icon { background: linear-gradient(135deg, #7b1fa2, #4a148c); box-shadow: 0 4px 12px rgba(123,31,162,.3); }
      .stat-info {
        flex: 1;
        h3 { margin: 0 0 4px; font-size: 13px; color: #999; font-weight: 500; text-transform: uppercase; letter-spacing: .5px; }
        .stat-number { margin: 0; font-size: 32px; font-weight: 700; color: #333; line-height: 1; }
        .stat-label { margin: 4px 0 0; font-size: 13px; color: #666; }
      }
    }

    .quick-actions-card {
      margin-bottom: 32px;
      mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 1.25rem; font-weight: 600; color: #00695c; }
      .actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        button { height: 52px; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px; }
      }
    }

    /* Two-column widget row */
    .widgets-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .widget-card {
      min-height: 240px;
      mat-card-title { font-size: 1.1rem; font-weight: 600; }
    }

    .widget-loading, .widget-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; padding: 2rem; color: #adb5bd; text-align: center;
      mat-icon { font-size: 36px; width: 36px; height: 36px; }
      button { margin-top: 4px; }
    }

    .widget-footer { display: flex; justify-content: flex-end; margin-top: 8px; }

    /* Appointments widget */
    .appt-summary {
      display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;
      .appt-chip {
        display: flex; align-items: center; gap: 4px;
        padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
        &.waiting   { background: #fff3e0; color: #e65100; }
        &.in-progress { background: #e3f2fd; color: #1565c0; }
        &.scheduled { background: #e8f5e9; color: #2e7d32; }
      }
    }

    .appt-list { display: flex; flex-direction: column; gap: 6px; }
    .appt-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 8px; background: #f8f9fa;
      .appt-time { font-size: 12px; font-weight: 700; color: #555; width: 36px; }
      .appt-info { flex: 1; display: flex; flex-direction: column;
        .appt-pet { font-size: 13px; font-weight: 700; }
        .appt-client { font-size: 12px; color: #6c757d; }
      }
      .appt-badge {
        font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
        &.badge-waiting    { background: #fff3e0; color: #e65100; }
        &.badge-in_progress { background: #e3f2fd; color: #1565c0; }
        &.badge-scheduled  { background: #e8f5e9; color: #2e7d32; }
        &.badge-completed  { background: #f3e5f5; color: #7b1fa2; }
        &.badge-cancelled  { background: #fce4ec; color: #c62828; }
      }
    }

    /* Loyalty widget */
    .loyalty-widget { cursor: default; }
    .loyalty-list { display: flex; flex-direction: column; gap: 6px; }
    .loyalty-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 8px;
      cursor: pointer; transition: background 0.15s;
      &:hover { background: #f8f9fa; }
      .loyalty-rank { font-size: 14px; font-weight: 800; color: #adb5bd; width: 20px; text-align: center; }
      .loyalty-avatar {
        width: 32px; height: 32px; border-radius: 50%;
        background: linear-gradient(135deg, #00695c, #00897b);
        color: white; display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700;
      }
      .loyalty-info { flex: 1; display: flex; flex-direction: column;
        .loyalty-name { font-size: 13px; font-weight: 700; }
        .loyalty-tier { font-size: 11px; font-weight: 600; }
        .tier-bronze { color: #bf360c; }
        .tier-silver { color: #455a64; }
        .tier-gold   { color: #f57f17; }
        .tier-platinum { color: #4527a0; }
      }
      .loyalty-pts { display: flex; flex-direction: column; align-items: flex-end;
        .pts { font-size: 16px; font-weight: 800; color: #7b1fa2; }
        .pts-label { font-size: 10px; color: #adb5bd; }
      }
    }

    /* Getting started card */
    .welcome-card {
      mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 1.25rem; font-weight: 600; color: #00695c; }
      .intro-text { font-size: 1.125rem; color: #666; margin-bottom: 24px; }
      .steps { display: flex; flex-direction: column; gap: 20px; }
      .step {
        display: flex; align-items: flex-start; gap: 16px;
        padding: 16px; background: #f5f5f5; border-radius: 8px; transition: all 0.3s;
        &:hover { background: #e8f5e9; transform: translateX(4px); }
        .step-number {
          background: linear-gradient(135deg, #00897b, #00695c);
          color: white; width: 40px; height: 40px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 700; flex-shrink: 0;
        }
        .step-content {
          h4 { margin: 0 0 8px; font-size: 1.1rem; font-weight: 600; }
          p  { margin: 0; color: #666; line-height: 1.5; }
        }
      }
    }

    @media (max-width: 768px) {
      .welcome-header h1 { font-size: 1.5rem; }
      .stats-grid { grid-template-columns: 1fr; gap: 16px; }
      .actions-grid { grid-template-columns: 1fr !important; }
    }
  `]
})
export class DashboardHomeComponent implements OnInit {
  private clientService = inject(ClientService);
  private petService = inject(PetService);
  private recordService = inject(MedicalRecordService);
  private vetService = inject(VeterinaryService);
  private apptService = inject(AppointmentService);
  private authService = inject(AuthService);
  private router = inject(Router);

  clientsCount = 0;
  petsCount = 0;
  recordsCount = 0;
  totalLoyaltyPoints = 0;

  loyaltyEnabled = false;
  appointmentsEnabled = false;

  todayAppointments: Appointment[] = [];
  loadingAppts = false;
  topClients: Client[] = [];
  loadingLoyalty = false;
  veterinaryId = '';

  get todayLabel(): string {
    return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' });
  }
  get waitingCount() { return this.todayAppointments.filter(a => a.status === 'waiting').length; }
  get inProgressCount() { return this.todayAppointments.filter(a => a.status === 'in_progress').length; }
  get scheduledCount() { return this.todayAppointments.filter(a => a.status === 'scheduled').length; }

  ngOnInit() {
    this.vetService.getCurrentVeterinary().pipe(take(1)).subscribe(vet => {
      if (!vet) return;
      this.veterinaryId = vet.id;
      this.appointmentsEnabled = !!vet.subscription?.modules?.appointments;
      this.loyaltyEnabled = !!vet.loyaltyProgram?.enabled;
      this.loadStatistics();
      if (this.appointmentsEnabled) this.loadTodayAppointments(vet.id);
      if (this.loyaltyEnabled) this.loadTopLoyaltyClients();
    });
  }

  private loadStatistics() {
    this.clientService.getClients().pipe(take(1)).subscribe(clients => {
      this.clientsCount = clients.length;
      if (this.loyaltyEnabled) {
        this.totalLoyaltyPoints = clients.reduce((sum, c) => sum + (c.loyaltyPoints ?? 0), 0);
      }
    });
    this.petService.getPets().pipe(take(1)).subscribe(pets => {
      this.petsCount = pets.filter(p => p.isActive).length;
    });
    this.recordService.getMedicalRecords().pipe(take(1)).subscribe(records => {
      this.recordsCount = records.length;
    });
  }

  private loadTodayAppointments(vetId: string) {
    this.loadingAppts = true;
    this.apptService.getTodayAppointments(vetId).subscribe({
      next: appts => { this.todayAppointments = appts; this.loadingAppts = false; },
      error: () => { this.loadingAppts = false; }
    });
  }

  private loadTopLoyaltyClients() {
    this.loadingLoyalty = true;
    this.clientService.getClients().pipe(take(1)).subscribe(clients => {
      this.topClients = clients
        .filter(c => (c.loyaltyPoints ?? 0) > 0)
        .sort((a, b) => (b.loyaltyPoints ?? 0) - (a.loyaltyPoints ?? 0))
        .slice(0, 6);
      this.loadingLoyalty = false;
    });
  }

  getInitials(client: Client): string {
    return `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`.toUpperCase();
  }

  getTierLabel(tier: string): string {
    const t: Record<string, string> = { bronze: '🥉 Bronce', silver: '🥈 Plata', gold: '🥇 Oro', platinum: '💎 Platino' };
    return t[tier] ?? '🥉 Bronce';
  }

  getStatusLabel(status: string): string {
    return this.apptService.getStatusLabel(status as any);
  }

  navigateTo(route: string) { this.router.navigate([route]); }
}

