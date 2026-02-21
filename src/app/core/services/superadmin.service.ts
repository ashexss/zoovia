import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, doc, updateDoc, Timestamp } from '@angular/fire/firestore';
import { Veterinary, Subscription } from '../models';

@Injectable({ providedIn: 'root' })
export class SuperadminService {
    private firestore = inject(Firestore);

    /**
     * Fetches ALL veterinaries across all tenants.
     * Only callable by superadmin users (enforced by guard + Firestore rules).
     */
    async getAllVeterinaries(): Promise<Veterinary[]> {
        const col = collection(this.firestore, 'veterinaries');
        const snapshot = await getDocs(col);
        return snapshot.docs.map(d => ({ ...d.data() as Veterinary, id: d.id }));
    }

    /**
     * Updates only the subscription field of a veterinary document.
     */
    async updateSubscription(vetId: string, subscription: Subscription): Promise<void> {
        const vetDoc = doc(this.firestore, 'veterinaries', vetId);
        await updateDoc(vetDoc, {
            subscription,
            updatedAt: Timestamp.now()
        });
    }
}
