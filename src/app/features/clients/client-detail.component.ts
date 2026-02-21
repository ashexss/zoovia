import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Client, Pet, LoyaltyTransaction, LoyaltyTier } from '../../core/models';
import { ClientService, PetService, LoyaltyService, DEFAULT_LOYALTY_PROGRAM } from '../../core/services';
import { VeterinaryService } from '../../core/services/veterinary.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
    selector: 'app-client-detail',
    standalone: true,
    imports: [
        CommonModule, RouterModule, FormsModule,
        MatCardModule, MatButtonModule, MatIconModule, MatListModule,
        MatDividerModule, MatProgressSpinnerModule, MatExpansionModule,
        MatTabsModule, MatFormFieldModule, MatInputModule, MatSelectModule,
        MatSnackBarModule, MatDialogModule, MatTooltipModule
    ],
    templateUrl: './client-detail.component.html',
    styleUrls: ['./client-detail.component.scss']
})
export class ClientDetailComponent implements OnInit {
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private clientService = inject(ClientService);
    private petService = inject(PetService);
    private loyaltyService = inject(LoyaltyService);
    private vetService = inject(VeterinaryService);
    private authService = inject(AuthService);
    private snackBar = inject(MatSnackBar);
    private cdr = inject(ChangeDetectorRef);

    client: Client | null = null;
    pets: Pet[] = [];
    loading = true;
    clientId: string | null = null;

    // Loyalty
    loyaltyHistory: LoyaltyTransaction[] = [];
    loadingHistory = false;
    veterinaryId = '';
    userId = '';

    // Manual adjust form
    adjustPoints = 0;
    adjustReason = '';
    adjustType: 'add' | 'redeem' = 'add';
    savingAdjust = false;

    ngOnInit(): void {
        this.clientId = this.route.snapshot.paramMap.get('id');
        this.authService.currentUser$.subscribe(u => {
            this.userId = u?.id ?? '';
        });
        this.vetService.getCurrentVeterinary().subscribe(vet => {
            this.veterinaryId = vet?.id ?? '';
        });
        if (this.clientId) {
            this.loadClientData(this.clientId);
        }
    }

    loadClientData(id: string): void {
        this.loading = true;
        this.clientService.getClientById(id).subscribe({
            next: (client) => {
                this.client = client || null;
                this.loading = false;
                this.cdr.detectChanges();
                if (client) this.loadLoyaltyHistory(id);
            },
            error: (error) => {
                console.error('[ClientDetail] Error loading client:', error);
                this.loading = false;
                this.cdr.detectChanges();
                this.router.navigate(['/dashboard/clients']);
            }
        });

        this.petService.getPetsByClient(id).subscribe({
            next: (pets) => {
                this.pets = pets;
                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Error loading pets:', error);
                this.cdr.detectChanges();
            }
        });
    }

    loadLoyaltyHistory(clientId: string): void {
        if (!this.veterinaryId) return;
        this.loadingHistory = true;
        this.loyaltyService.getHistory(this.veterinaryId, clientId, 15).subscribe({
            next: (txs) => {
                this.loyaltyHistory = txs;
                this.loadingHistory = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.loadingHistory = false;
                this.cdr.detectChanges();
            }
        });
    }

    // ─── Loyalty Actions ────────────────────────────────────────────────────────

    async applyAdjustment(): Promise<void> {
        if (!this.client || !this.veterinaryId || this.adjustPoints <= 0) return;
        this.savingAdjust = true;
        const currentBalance = this.client.loyaltyPoints ?? 0;

        try {
            if (this.adjustType === 'redeem') {
                await this.loyaltyService.redeemPoints({
                    veterinaryId: this.veterinaryId,
                    clientId: this.client.id,
                    currentBalance,
                    points: this.adjustPoints,
                    description: this.adjustReason || `Canje de ${this.adjustPoints} pts`,
                    createdBy: this.userId,
                    program: DEFAULT_LOYALTY_PROGRAM
                });
                this.snackBar.open(`Se canjearon ${this.adjustPoints} puntos`, 'OK', { duration: 3000 });
            } else {
                await this.loyaltyService.adjustPoints({
                    veterinaryId: this.veterinaryId,
                    clientId: this.client.id,
                    currentBalance,
                    points: this.adjustPoints,
                    description: this.adjustReason || `Ajuste manual: +${this.adjustPoints} pts`,
                    createdBy: this.userId
                });
                this.snackBar.open(`Se agregaron ${this.adjustPoints} puntos`, 'OK', { duration: 3000 });
            }
            // Refresh
            this.adjustPoints = 0;
            this.adjustReason = '';
            this.loadClientData(this.client.id);
        } catch (e: any) {
            this.snackBar.open(e.message || 'Error al procesar puntos', 'Cerrar', { duration: 4000 });
        } finally {
            this.savingAdjust = false;
        }
    }

    // ─── Display Helpers ────────────────────────────────────────────────────────

    get loyaltyPoints(): number { return this.client?.loyaltyPoints ?? 0; }
    get loyaltyTier(): LoyaltyTier { return this.client?.loyalty?.tier ?? 'bronze'; }
    get totalEarned(): number { return this.client?.loyalty?.totalEarned ?? 0; }
    get totalRedeemed(): number { return this.client?.loyalty?.totalRedeemed ?? 0; }

    // Cache nextTierInfo to prevent NG0100 (returning new object ref every CD cycle)
    private _lastTotalEarned = -1;
    private _cachedNextTierInfo: any = null;

    get nextTierInfo() {
        const currentEarned = this.totalEarned;
        if (currentEarned !== this._lastTotalEarned || !this._cachedNextTierInfo) {
            this._lastTotalEarned = currentEarned;
            this._cachedNextTierInfo = this.loyaltyService.getNextTierInfo(currentEarned, DEFAULT_LOYALTY_PROGRAM.tiers);
        }
        return this._cachedNextTierInfo;
    }

    get tierLabel(): string { return this.loyaltyService.getTierLabel(this.loyaltyTier); }
    get tierClass(): string { return this.loyaltyService.getTierCssClass(this.loyaltyTier); }
    get pointsAsCurrency(): string {
        return this.loyaltyService.pointsToCurrency(this.loyaltyPoints, DEFAULT_LOYALTY_PROGRAM.redemptionRate);
    }

    get nextTierProgress(): number {
        const info = this.nextTierInfo;
        if (!info) return 100;
        const tiers = DEFAULT_LOYALTY_PROGRAM.tiers;
        const current = this.totalEarned;
        const thresholds = [tiers.bronze, tiers.silver, tiers.gold, tiers.platinum];
        const tierIdx = thresholds.findIndex(t => current < t) - 1;
        const start = thresholds[Math.max(0, tierIdx)] ?? 0;
        const MathEnd = (start + info.pointsNeeded);
        if (MathEnd === start) return 100;
        return Math.min(100, Math.round(((current - start) / (MathEnd - start)) * 100));
    }

    getTxIcon(type: LoyaltyTransaction['type']): string {
        return this.loyaltyService.getTransactionIcon(type);
    }
    getTxLabel(type: LoyaltyTransaction['type']): string {
        return this.loyaltyService.getTransactionLabel(type);
    }
    txIsPositive(tx: LoyaltyTransaction): boolean {
        return tx.points > 0;
    }
    formatDate(ts: any): string {
        const d = ts?.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    // ─── Navigation ─────────────────────────────────────────────────────────────

    addPet(): void {
        this.router.navigate(['/dashboard/pets/new'], { queryParams: { clientId: this.clientId } });
    }
    viewPet(petId: string): void { this.router.navigate(['/dashboard/pets', petId]); }
    editClient(): void { this.router.navigate(['/dashboard/clients', this.clientId, 'edit']); }
    goBack(): void { this.router.navigate(['/dashboard/clients']); }

    getClientInitials(): string {
        if (!this.client) return '';
        return `${this.client.firstName?.charAt(0)?.toUpperCase() || ''}${this.client.lastName?.charAt(0)?.toUpperCase() || ''}`;
    }
    getPetIcon(species: string): string {
        const icons: Record<string, string> = { dog: 'pets', cat: 'pets', bird: 'flutter_dash', rabbit: 'cruelty_free', other: 'pets' };
        return icons[species.toLowerCase()] || 'pets';
    }
}
