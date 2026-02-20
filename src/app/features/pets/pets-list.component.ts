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
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { Pet, Client } from '../../core/models';
import { PetService, ClientService } from '../../core/services';

@Component({
  selector: 'app-pets-list',
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
  templateUrl: './pets-list.component.html',
  styleUrls: ['./pets-list.component.scss']
})
export class PetsListComponent implements OnInit {
  private petService = inject(PetService);
  private clientService = inject(ClientService);
  private cdr = inject(ChangeDetectorRef);

  displayedColumns: string[] = ['photo', 'name', 'species', 'breed', 'owner', 'age', 'weight', 'actions'];
  dataSource = new MatTableDataSource<Pet>([]);
  searchControl = new FormControl('');
  loading = false;

  // Cache for client names
  clientsMap = new Map<string, Client>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadClients();
    this.loadPets();
    this.setupSearch();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Load clients for displaying owner names
   */
  loadClients(): void {
    this.clientService.getClients().subscribe({
      next: (clients) => {
        clients.forEach(client => {
          this.clientsMap.set(client.id, client);
        });
      },
      error: (error) => {
        console.error('Error loading clients:', error);
      }
    });
  }

  /**
   * Load all pets
   */
  loadPets(): void {
    this.loading = true;
    this.petService.getPets().subscribe({
      next: (pets) => {
        // Filter only active pets
        this.dataSource.data = pets.filter(p => p.isActive);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading pets:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Setup search functionality with debounce
   */
  setupSearch(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(searchTerm => {
        if (searchTerm && searchTerm.trim()) {
          this.loading = true;
          this.petService.searchPets(searchTerm.trim()).subscribe({
            next: (pets) => {
              this.dataSource.data = pets.filter(p => p.isActive);
              this.loading = false;
            },
            error: (error) => {
              console.error('Error searching pets:', error);
              this.loading = false;
            }
          });
        } else {
          this.loadPets();
        }
      });
  }

  /**
   * Delete a pet (soft delete)
   */
  async deletePet(pet: Pet): Promise<void> {
    if (confirm(`¿Está seguro de eliminar a ${pet.name}?`)) {
      try {
        await this.petService.deletePet(pet.id);
        this.loadPets();
      } catch (error) {
        console.error('Error deleting pet:', error);
        alert('Error al eliminar la mascota');
      }
    }
  }

  /**
   * Get owner name from clientId
   */
  getOwnerName(clientId: string): string {
    const client = this.clientsMap.get(clientId);
    if (client) {
      return `${client.firstName} ${client.lastName}`;
    }
    return 'Desconocido';
  }

  /**
   * Get pet age as string
   */
  getPetAge(birthDate: any): string {
    const age = this.petService.calculateAge(birthDate);
    if (age.years === 0) {
      return `${age.months} meses`;
    } else if (age.months === 0) {
      return `${age.years} ${age.years === 1 ? 'año' : 'años'}`;
    } else {
      return `${age.years}a ${age.months}m`;
    }
  }

  /**
   * Get species icon
   */
  getSpeciesIcon(species: string): string {
    const icons: Record<string, string> = {
      dog: 'pets',
      cat: 'pets',
      bird: 'flutter_dash',
      rabbit: 'cruelty_free',
      other: 'pets'
    };
    return icons[species] || 'pets';
  }

  /**
   * Get species label
   */
  getSpeciesLabel(species: string): string {
    const labels: Record<string, string> = {
      dog: 'Perro',
      cat: 'Gato',
      bird: 'Ave',
      rabbit: 'Conejo',
      other: 'Otro'
    };
    return labels[species] || species;
  }
}
