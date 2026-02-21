import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
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
    limit,
    Timestamp
} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import {
    LoyaltyTransaction,
    LoyaltyTransactionType,
    LoyaltyTier,
    LoyaltyProgram
} from '../models/index';

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_LOYALTY_PROGRAM: LoyaltyProgram = {
    enabled: true,
    pointsPerVisit: 10,
    pointsPerGrooming: 15,
    pointsPerPurchasePeso: 1,
    redemptionRate: 100,   // 100 points = $1
    tiers: {
        bronze: 0,
        silver: 200,
        gold: 500,
        platinum: 1000
    }
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LoyaltyService {
    private firestore = inject(Firestore);
    private injector = inject(Injector);

    private txCol() {
        return collection(this.firestore, 'loyalty_transactions');
    }

    // ── Read ────────────────────────────────────────────────────────────────────

    /** Get last N transactions for a client */
    getHistory(veterinaryId: string, clientId: string, count = 20): Observable<LoyaltyTransaction[]> {
        const q = query(
            this.txCol(),
            where('veterinaryId', '==', veterinaryId),
            where('clientId', '==', clientId),
            orderBy('createdAt', 'desc'),
            limit(count)
        );
        return from(runInInjectionContext(this.injector, () => getDocs(q))).pipe(
            map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as LoyaltyTransaction)))
        );
    }

    // ── Write ───────────────────────────────────────────────────────────────────

    /**
     * Core method: add/subtract points and persist both the transaction
     * and the updated balance on the client document.
     */
    async recordPoints(params: {
        veterinaryId: string;
        clientId: string;
        currentBalance: number;
        points: number;              // positive = earn, negative = spend
        type: LoyaltyTransactionType;
        description: string;
        createdBy: string;
        referenceType?: LoyaltyTransaction['referenceType'];
        referenceId?: string;
        loyaltyProgram?: LoyaltyProgram;
    }): Promise<void> {
        const {
            veterinaryId, clientId, currentBalance, points, type,
            description, createdBy, referenceType, referenceId, loyaltyProgram
        } = params;

        const newBalance = Math.max(0, currentBalance + points);

        // Record transaction
        await addDoc(this.txCol(), {
            veterinaryId,
            clientId,
            type,
            points,
            balanceAfter: newBalance,
            referenceType: referenceType ?? null,
            referenceId: referenceId ?? null,
            description,
            createdBy,
            createdAt: Timestamp.now()
        });

        // Update client balance + tier + totals
        const clientRef = doc(this.firestore, 'clients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) return;

        const current = clientSnap.data() as any;
        const prevLoyalty = current.loyalty ?? {};
        const prevEarned = prevLoyalty.totalEarned ?? 0;
        const prevRedeemed = prevLoyalty.totalRedeemed ?? 0;

        const newEarned = points > 0 ? prevEarned + points : prevEarned;
        const newRedeemed = points < 0 ? prevRedeemed + Math.abs(points) : prevRedeemed;

        const tier = this.getTierForPoints(
            newEarned,
            loyaltyProgram?.tiers ?? DEFAULT_LOYALTY_PROGRAM.tiers
        );

        const loyaltyUpdate: any = {
            loyaltyPoints: newBalance,
            'loyalty.totalEarned': newEarned,
            'loyalty.totalRedeemed': newRedeemed,
            'loyalty.tier': tier,
            updatedAt: Timestamp.now()
        };

        // Set enrolledAt on first points
        if (!prevLoyalty.enrolledAt) {
            loyaltyUpdate['loyalty.enrolledAt'] = Timestamp.now();
        }

        await updateDoc(clientRef, loyaltyUpdate);
    }

    /** Award points for a completed appointment */
    async awardVisitPoints(params: {
        veterinaryId: string;
        clientId: string;
        clientName: string;
        currentBalance: number;
        appointmentId: string;
        petName: string;
        createdBy: string;
        program: LoyaltyProgram;
    }): Promise<void> {
        return this.recordPoints({
            veterinaryId: params.veterinaryId,
            clientId: params.clientId,
            currentBalance: params.currentBalance,
            points: params.program.pointsPerVisit,
            type: 'earned_visit',
            description: `Consulta de ${params.petName}`,
            createdBy: params.createdBy,
            referenceType: 'appointment',
            referenceId: params.appointmentId,
            loyaltyProgram: params.program
        });
    }

    /** Redeem points (e.g. for a discount) */
    async redeemPoints(params: {
        veterinaryId: string;
        clientId: string;
        currentBalance: number;
        points: number;
        description: string;
        createdBy: string;
        program: LoyaltyProgram;
    }): Promise<void> {
        if (params.currentBalance < params.points) {
            throw new Error('Saldo insuficiente de puntos');
        }
        return this.recordPoints({
            ...params,
            points: -params.points,   // negative = spending
            type: 'redeemed',
            referenceType: 'redemption'
        });
    }

    /** Manual adjustment by admin */
    async adjustPoints(params: {
        veterinaryId: string;
        clientId: string;
        currentBalance: number;
        points: number;
        description: string;
        createdBy: string;
    }): Promise<void> {
        return this.recordPoints({ ...params, type: 'adjusted' });
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    getTierForPoints(totalEarned: number, tiers: LoyaltyProgram['tiers']): LoyaltyTier {
        if (totalEarned >= tiers.platinum) return 'platinum';
        if (totalEarned >= tiers.gold) return 'gold';
        if (totalEarned >= tiers.silver) return 'silver';
        return 'bronze';
    }

    getTierLabel(tier: LoyaltyTier): string {
        const labels: Record<LoyaltyTier, string> = {
            bronze: '🥉 Bronce',
            silver: '🥈 Plata',
            gold: '🥇 Oro',
            platinum: '💎 Platino'
        };
        return labels[tier];
    }

    getTierCssClass(tier: LoyaltyTier): string {
        return `tier-${tier}`;
    }

    /** Points to next tier, and next tier name */
    getNextTierInfo(totalEarned: number, tiers: LoyaltyProgram['tiers']): { nextTier: string; pointsNeeded: number } | null {
        if (totalEarned < tiers.silver) return { nextTier: '🥈 Plata', pointsNeeded: tiers.silver - totalEarned };
        if (totalEarned < tiers.gold) return { nextTier: '🥇 Oro', pointsNeeded: tiers.gold - totalEarned };
        if (totalEarned < tiers.platinum) return { nextTier: '💎 Platino', pointsNeeded: tiers.platinum - totalEarned };
        return null; // already platinum
    }

    /** Convert points to currency */
    pointsToCurrency(points: number, rate: number): string {
        return `$${(points / rate).toFixed(0)}`;
    }

    getTransactionLabel(type: LoyaltyTransactionType): string {
        const labels: Record<LoyaltyTransactionType, string> = {
            earned_visit: 'Consulta',
            earned_purchase: 'Compra',
            earned_grooming: 'Peluquería',
            redeemed: 'Canje',
            adjusted: 'Ajuste manual',
            expired: 'Vencimiento'
        };
        return labels[type];
    }

    getTransactionIcon(type: LoyaltyTransactionType): string {
        const icons: Record<LoyaltyTransactionType, string> = {
            earned_visit: 'medical_services',
            earned_purchase: 'shopping_bag',
            earned_grooming: 'content_cut',
            redeemed: 'redeem',
            adjusted: 'tune',
            expired: 'timer_off'
        };
        return icons[type];
    }
}
