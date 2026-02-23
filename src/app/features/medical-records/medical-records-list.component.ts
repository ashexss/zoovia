import { Component, OnInit, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { combineLatest, Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, take } from 'rxjs/operators';

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
    MatChipsModule,
    MatAutocompleteModule
  ],
  templateUrl: './medical-records-list.component.html',
  styleUrls: ['./medical-records-list.component.scss']
})
export class MedicalRecordsListComponent implements OnInit {
  private recordService = inject(MedicalRecordService);
  private petService = inject(PetService);
  private clientService = inject(ClientService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  displayedColumns: string[] = ['date', 'type', 'pet', 'client', 'diagnosis', 'veterinarian', 'actions'];
  dataSource = new MatTableDataSource<MedicalRecord>([]);
  searchControl = new FormControl('');
  loading = false;

  // Search and Selection State
  clientSearchControl = new FormControl('');
  searchResults: Client[] = [];
  loadingSearch = false;
  selectedClient: Client | null = null;
  clientPets$: Observable<Pet[]> | undefined;
  selectedPetId: string | null = null;

  // Cache for pets and clients
  petsMap = new Map<string, Pet>();
  clientsMap = new Map<string, Client>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.setupClientSearch();
    this.checkQueryParams();
  }

  checkQueryParams() {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const clientId = params['clientId'];
      const petId = params['petId'];

      if (clientId && petId) {
        this.loadingSearch = true;
        this.clientService.getClientById(clientId).pipe(take(1)).subscribe(client => {
          this.loadingSearch = false;
          if (client) {
            this.selectClient(client);
            // Must trigger selectPet immediately next
            this.selectPet(petId);
          }
        });
      }
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  setupClientSearch() {
    this.clientSearchControl.valueChanges.pipe(
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

  selectClient(client: Client) {
    this.selectedClient = client;
    this.clientSearchControl.setValue('');
    this.searchResults = [];
    this.selectedPetId = null;
    this.dataSource.data = [];
    this.clientPets$ = this.petService.getPetsByClient(client.id);
  }

  selectPet(petId: string) {
    this.selectedPetId = petId;
    this.loadDataForPet(petId);
  }

  clearSelection() {
    this.selectedClient = null;
    this.selectedPetId = null;
    this.clientPets$ = undefined;
    this.dataSource.data = [];

    // Clear URL params so they don't persist on refresh or navigation 
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { clientId: null, petId: null },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Load data only for the selected pet
   */
  loadDataForPet(petId: string): void {
    if (!petId) return;
    this.loading = true;

    combineLatest([
      this.recordService.getMedicalRecordsByPet(petId),
      this.petService.getPets(),
      this.clientService.getClients()
    ]).pipe(take(1)).subscribe({
      next: ([records, pets, clients]: [MedicalRecord[] | undefined, Pet[] | undefined, Client[] | undefined]) => {
        // Build caches
        if (pets) {
          pets.forEach((pet: Pet) => this.petsMap.set(pet.id, pet));
        }
        if (clients) {
          clients.forEach((client: Client) => this.clientsMap.set(client.id, client));
        }

        // Set records
        this.dataSource.data = records || [];
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
        if (this.selectedPetId) {
          this.loadDataForPet(this.selectedPetId);
        }
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
      surgery: 'Cirugía',
      checkup: 'Control'
    };
    return labels[type] || type;
  }

  /**
   * Get record type color
   */
  getTypeColor(type: MedicalRecordType): string {
    const colors: Record<MedicalRecordType, string> = {
      consultation: 'primary',
      surgery: 'warn',
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
