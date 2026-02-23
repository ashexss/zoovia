import { Component, OnInit, inject, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
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
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Client } from '../../core/models';
import { ClientService } from '../../core/services';

@Component({
  selector: 'app-clients-list',
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
    MatProgressSpinnerModule
  ],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss']
})
export class ClientsListComponent implements OnInit {
  private clientService = inject(ClientService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  displayedColumns: string[] = ['firstName', 'lastName', 'email', 'phone', 'city', 'loyaltyPoints', 'actions'];
  dataSource = new MatTableDataSource<Client>([]);
  searchControl = new FormControl('');
  loading = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadClients();
    this.setupSearch();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Load all clients
   */
  loadClients(): void {
    console.log('[ClientsList] Starting to load clients...');
    this.loading = true;
    this.clientService.getClients().subscribe({
      next: (clients) => {
        this.zone.run(() => {
          console.log('[ClientsList] Received clients:', clients);
          this.dataSource.data = clients;
          this.loading = false;
          this.cdr.markForCheck(); // Safely flag for change detection
          console.log('[ClientsList] Change detection triggered, loading =', this.loading);
        });
      },
      error: (error) => {
        this.zone.run(() => {
          console.error('[ClientsList] Error loading clients:', error);
          this.loading = false;
          this.cdr.markForCheck(); // Safely flag for change detection
        });
      },
      complete: () => {
        console.log('[ClientsList] Observable completed');
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
          Promise.resolve().then(() => {
            this.loading = true;
            this.cdr.markForCheck();
          });
          this.clientService.searchClients(searchTerm.trim()).subscribe({
            next: (clients) => {
              this.dataSource.data = clients;
              this.loading = false;
              this.cdr.markForCheck();
            },
            error: (error) => {
              console.error('Error searching clients:', error);
              this.loading = false;
              this.cdr.markForCheck();
            }
          });
        } else {
          this.loadClients();
        }
      });
  }

  /**
   * Delete a client
   */
  async deleteClient(client: Client): Promise<void> {
    if (confirm(`¿Está seguro de eliminar al cliente ${client.firstName} ${client.lastName}?`)) {
      try {
        await this.clientService.deleteClient(client.id);
        this.loadClients();
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('Error al eliminar el cliente');
      }
    }
  }

  /**
   * Get full name of client
   */
  getFullName(client: Client): string {
    return `${client.firstName} ${client.lastName}`;
  }
}
