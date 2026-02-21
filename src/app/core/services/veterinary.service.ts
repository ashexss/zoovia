import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
    Firestore,
    doc,
    docData,
    getDoc,
    updateDoc,
    Timestamp,
    DocumentSnapshot
} from '@angular/fire/firestore';
import {
    Storage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from '@angular/fire/storage';
import { Observable, BehaviorSubject, of, from } from 'rxjs';
import { switchMap, take, map, tap } from 'rxjs/operators';
import { Veterinary } from '../models';
import { AuthService } from '../auth/auth.service';

@Injectable({
    providedIn: 'root'
})
export class VeterinaryService {
    private firestore = inject(Firestore);
    private storage = inject(Storage);
    private authService = inject(AuthService);
    private injector = inject(Injector);

    // Cache
    private veterinaryCache$ = new BehaviorSubject<Veterinary | null>(null);
    private cacheLoaded = false;

    /**
     * Get veterinary by ID (with cache)
     */
    getVeterinary(id: string): Observable<Veterinary | undefined> {
        // If cache is loaded and matches the requested ID, return cached data
        if (this.cacheLoaded && this.veterinaryCache$.value?.id === id) {
            console.log('[VeterinaryService] Returning cached veterinary');
            return of(this.veterinaryCache$.value);
        }

        // Otherwise, load from Firestore
        console.log('[VeterinaryService] Loading veterinary from Firestore');
        return this.loadVeterinaryFromFirestore(id);
    }

    /**
     * Load veterinary from Firestore and update cache
     */
    private loadVeterinaryFromFirestore(id: string): Observable<Veterinary | undefined> {
        const vetDoc = doc(this.firestore, 'veterinaries', id);

        // Use getDoc instead of docData to handle missing documents properly
        const getDocPromise = runInInjectionContext(this.injector, () => getDoc(vetDoc));
        return from(getDocPromise).pipe(
            take(1),
            map((snapshot: DocumentSnapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() as Veterinary;
                    const veterinary = { ...data, id: snapshot.id };
                    console.log('[VeterinaryService] Loaded veterinary from Firestore:', veterinary.name);
                    this.veterinaryCache$.next(veterinary);
                    this.cacheLoaded = true;
                    return veterinary;
                } else {
                    console.warn('[VeterinaryService] Veterinary document not found:', id);
                    return undefined;
                }
            })
        );
    }

    /**
     * Get current user's veterinary
     */
    getCurrentVeterinary(): Observable<Veterinary | undefined> {
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap(currentUser => {
                if (!currentUser?.veterinaryId) {
                    console.warn('[VeterinaryService] No veterinaryId found for current user');
                    return of(undefined);
                }
                return this.getVeterinary(currentUser.veterinaryId);
            })
        );
    }

    /**
     * Update veterinary information
     */
    async updateVeterinary(id: string, data: Partial<Veterinary>): Promise<void> {
        const vetDoc = doc(this.firestore, 'veterinaries', id);

        const updateData = {
            ...data,
            updatedAt: Timestamp.now()
        };

        // Remove fields that shouldn't be updated
        delete (updateData as any).id;
        delete (updateData as any).createdAt;

        await updateDoc(vetDoc, updateData);

        // Invalidate cache
        this.refreshVeterinary(id).subscribe();
    }

    /**
     * Upload logo to Firebase Storage
     */
    async uploadLogo(veterinaryId: string, file: File): Promise<string> {
        try {
            // Create a reference to the logo file
            const fileExtension = file.name.split('.').pop();
            const logoPath = `veterinaries/${veterinaryId}/logo.${fileExtension}`;
            const storageRef = ref(this.storage, logoPath);

            // Upload the file
            console.log('[VeterinaryService] Uploading logo to Storage');
            await uploadBytes(storageRef, file);

            // Get the download URL
            const downloadURL = await getDownloadURL(storageRef);
            console.log('[VeterinaryService] Logo uploaded successfully');

            return downloadURL;
        } catch (error) {
            console.error('[VeterinaryService] Error uploading logo:', error);
            throw error;
        }
    }

    /**
     * Delete logo from Firebase Storage
     */
    async deleteLogo(veterinaryId: string, logoUrl: string): Promise<void> {
        try {
            // Extract the file path from the URL
            const logoPath = `veterinaries/${veterinaryId}/logo`;
            const storageRef = ref(this.storage, logoPath);

            await deleteObject(storageRef);
            console.log('[VeterinaryService] Logo deleted successfully');
        } catch (error) {
            console.error('[VeterinaryService] Error deleting logo:', error);
            throw error;
        }
    }

    /**
     * Refresh cache by reloading from Firestore
     */
    refreshVeterinary(id: string): Observable<Veterinary | undefined> {
        console.log('[VeterinaryService] Refreshing veterinary cache');
        this.cacheLoaded = false;
        return this.loadVeterinaryFromFirestore(id);
    }

    /**
     * Migration helper: if a veterinary document doesn't have subscription data,
     * write sensible defaults so the new subscription UI works without errors.
     * This is a one-time, self-healing migration — safe to call on every load.
     */
    /**
     * Migration helper: if a veterinary document has no subscription at all,
     * writes minimal placeholder data so the UI doesn't break.
     * The actual plan is set manually by the superadmin.
     */
    async ensureSubscription(id: string): Promise<void> {
        const vetDoc = doc(this.firestore, 'veterinaries', id);
        const snapshot = await getDoc(vetDoc);
        if (!snapshot.exists()) return;

        const data = snapshot.data() as any;
        // Already has a subscription — nothing to do
        if (data?.subscription?.plan) return;

        const { BusinessType } = await import('../models/subscription');

        const placeholderSub = {
            plan: 'base_vet',
            businessType: data?.businessType ?? BusinessType.VETERINARY,
            modules: {
                clients: true,
                pets: true,
                medicalRecords: true,
                appointments: false,
                loyalty: false,
                grooming: false,
                inventory: false,
            },
            billingCycle: 'monthly',
            monthlyPrice: 0,
            currency: 'ARS',
            status: 'active',
            billingContactEmail: data?.email ?? '',
            currentPeriodStart: Timestamp.now(),
            currentPeriodEnd: Timestamp.fromDate(new Date(Date.now() + 30 * 86400000)),
            nextBillingDate: Timestamp.fromDate(new Date(Date.now() + 30 * 86400000)),
        };

        await updateDoc(vetDoc, {
            businessType: placeholderSub.businessType,
            subscription: placeholderSub
        });

        console.log('[VeterinaryService] ensureSubscription: placeholder created for', id);
    }
}
