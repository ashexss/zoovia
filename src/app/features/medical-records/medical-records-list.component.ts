import { Component, OnInit, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { combineLatest } from 'rxjs';

import { MedicalRecord, Pet, Client, MedicalRecordType } from '../../core/models';
import { MedicalRecordService, PetService, ClientService } from '../../core/services';

@Component({
  selector: 'app-medical-records-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
  templateUrl: './medical-records-list.component.html',
  styleUrls: ['./medical-records-list.component.scss']
})
export class MedicalRecordsListComponent implements OnInit {
  private recordService = inject(MedicalRecordService);
  private petService = inject(PetService);
  private clientService = inject(ClientService);
  private cdr = inject(ChangeDetectorRef);

  displayedColumns: string[] = ['date', 'type', 'pet', 'client', 'diagnosis', 'veterinarian', 'actions'];
  dataSource = new MatTableDataSource<MedicalRecord>([]);
  searchControl = new FormControl('');
  loading = false;

  // Cache for pets and clients
  petsMap = new Map<string, Pet>();
  clientsMap = new Map<string, Client>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Load all data (records, pets, clients)
   */
  loadData(): void {
    this.loading = true;

    combineLatest([
      this.recordService.getMedicalRecords(),
      this.petService.getPets(),
      this.clientService.getClients()
    ]).subscribe({
      next: ([records, pets, clients]) => {
        // Build caches
        pets.forEach(pet => this.petsMap.set(pet.id, pet));
        clients.forEach(client => this.clientsMap.set(client.id, client));

        // Set records
        this.dataSource.data = records;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading data:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Delete a medical record
   */
  async deleteRecord(record: MedicalRecord): Promise<void> {
    const petName = this.getPetName(record.petId);
    if (confirm(`¿Está seguro de eliminar el registro médico de ${petName}?`)) {
      try {
        await this.recordService.deleteRecord(record.id);
        this.loadData();
      } catch (error) {
        console.error('Error deleting record:', error);
        alert('Error al eliminar el registro');
      }
    }
  }

  /**
   * Get pet name from petId
   */
  getPetName(petId: string): string {
    const pet = this.petsMap.get(petId);
    return pet ? pet.name : 'Desconocido';
  }

  /**
   * Get client name from clientId
   */
  getClientName(clientId: string): string {
    const client = this.clientsMap.get(clientId);
    if (client) {
      return `${client.firstName} ${client.lastName}`;
    }
    return 'Desconocido';
  }

  /**
   * Get record type label
   */
  getTypeLabel(type: MedicalRecordType): string {
    const labels: Record<MedicalRecordType, string> = {
      consultation: 'Consulta',
      vaccination: 'Vacunación',
      surgery: 'Cirugía',
      treatment: 'Tratamiento',
      checkup: 'Chequeo'
    };
    return labels[type] || type;
  }

  /**
   * Get record type color
   */
  getTypeColor(type: MedicalRecordType): string {
    const colors: Record<MedicalRecordType, string> = {
      consultation: 'primary',
      vaccination: 'accent',
      surgery: 'warn',
      treatment: 'primary',
      checkup: 'accent'
    };
    return colors[type] || 'primary';
  }

  /**
   * Format date
   */
  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get prescription count
   */
  getPrescriptionCount(record: MedicalRecord): number {
    return record.prescriptions?.length || 0;
  }

  /**
   * Calculate total cost
   */
  getTotalCost(record: MedicalRecord): number {
    return this.recordService.calculatePrescriptionTotal(record.prescriptions || []);
  }
}
