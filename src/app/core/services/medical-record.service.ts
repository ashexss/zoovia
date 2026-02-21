import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
    Firestore,
    collection,
    collectionData,
    doc,
    docData,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp
} from '@angular/fire/firestore';
import { Observable, of, BehaviorSubject, throwError, TimeoutError } from 'rxjs';
import { switchMap, take, map, tap, timeout, catchError } from 'rxjs/operators';
import { MedicalRecord, Prescription } from '../models';
import { AuthService } from '../auth/auth.service';

@Injectable({
    providedIn: 'root'
})
export class MedicalRecordService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);
    private injector = inject(Injector);

    // Cache
    private recordsCache$ = new BehaviorSubject<MedicalRecord[] | null>(null);
    private cacheLoaded = false;

    /**
     * Get all medical records for the current user's veterinary (with cache)
     */
    getMedicalRecords(): Observable<MedicalRecord[]> {
        // If cache is loaded, return cached data
        if (this.cacheLoaded && this.recordsCache$.value !== null) {
            console.log('[MedicalRecordService] Returning cached records');
            return of(this.recordsCache$.value);
        }

        // Otherwise, load from Firestore
        console.log('[MedicalRecordService] Loading records from Firestore');
        return this.loadRecordsFromFirestore();
    }

    /**
     * Load medical records from Firestore and update cache
     */
    private loadRecordsFromFirestore(): Observable<MedicalRecord[]> {
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap(currentUser => {
                if (!currentUser?.veterinaryId) {
                    return of([]);
                }

                const recordsCol = collection(this.firestore, 'medicalRecords');
                const q = query(
                    recordsCol,
                    where('veterinaryId', '==', currentUser.veterinaryId),
                    orderBy('date', 'desc')
                );

                return runInInjectionContext(this.injector, () => collectionData(q, { idField: 'id' })).pipe(
                    timeout(1000),
                    catchError((err) => {
                        if (err instanceof TimeoutError) {
                            console.warn('[MedicalRecordService] Firestore collectionData timed out for all records.');
                            return of([]);
                        }
                        return throwError(() => err);
                    }),
                    take(1),
                    map(data => data as MedicalRecord[]),
                    tap(records => {
                        console.log('[MedicalRecordService] Loaded', records.length, 'records from Firestore');
                        this.recordsCache$.next(records);
                        this.cacheLoaded = true;
                    })
                );
            })
        );
    }

    /**
     * Refresh cache by reloading from Firestore
     */
    refreshRecords(): Observable<MedicalRecord[]> {
        console.log('[MedicalRecordService] Refreshing records cache');
        this.cacheLoaded = false;
        return this.loadRecordsFromFirestore();
    }

    /**
     * Get medical records by pet ID
     */
    getRecordsByPet(petId: string): Observable<MedicalRecord[]> {
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap(currentUser => {
                if (!currentUser?.veterinaryId) {
                    return of([]); // Return an observable that immediately emits an empty array
                }

                const recordsCol = collection(this.firestore, 'medicalRecords');
                const q = query(
                    recordsCol,
                    where('veterinaryId', '==', currentUser.veterinaryId),
                    where('petId', '==', petId),
                    orderBy('date', 'desc')
                );

                return collectionData(q, { idField: 'id' }) as Observable<MedicalRecord[]>;
            })
        );
    }

    /**
     * Get medical records by client ID
     */
    getRecordsByClient(clientId: string): Observable<MedicalRecord[]> {
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap(currentUser => {
                if (!currentUser?.veterinaryId) {
                    return of([]); // Return an observable that immediately emits an empty array
                }

                const recordsCol = collection(this.firestore, 'medicalRecords');
                const q = query(
                    recordsCol,
                    where('veterinaryId', '==', currentUser.veterinaryId),
                    where('clientId', '==', clientId),
                    orderBy('date', 'desc')
                );

                return collectionData(q, { idField: 'id' }) as Observable<MedicalRecord[]>;
            })
        );
    }

    /**
     * Get a single medical record by ID
     */
    getRecordById(id: string): Observable<MedicalRecord | undefined> {
        const recordDoc = doc(this.firestore, 'medicalRecords', id);
        return docData(recordDoc, { idField: 'id' }) as Observable<MedicalRecord | undefined>;
    }

    /**
     * Create a new medical record
     */
    async createRecord(recordData: Partial<MedicalRecord>): Promise<string> {
        const currentUser = await this.authService.getUserProfile();

        if (!currentUser?.veterinaryId) {
            throw new Error('User must belong to a veterinary to create records');
        }

        if (!recordData.petId) {
            throw new Error('Medical record must be associated with a pet');
        }

        if (!recordData.clientId) {
            throw new Error('Medical record must be associated with a client');
        }

        const newRecord: Omit<MedicalRecord, 'id'> = {
            veterinaryId: currentUser.veterinaryId,
            petId: recordData.petId,
            clientId: recordData.clientId,
            date: recordData.date || Timestamp.now(),
            type: recordData.type || 'consultation',
            veterinarianId: currentUser.id,
            diagnosis: recordData.diagnosis || '',
            treatment: recordData.treatment || '',
            notes: recordData.notes || '',
            prescriptions: recordData.prescriptions || [],
            attachments: recordData.attachments || [],
            createdAt: Timestamp.now()
        };

        const recordsCol = collection(this.firestore, 'medicalRecords');
        const docRef = await addDoc(recordsCol, newRecord);

        // Invalidate cache
        this.refreshRecords().subscribe();

        return docRef.id;
    }

    /**
     * Update an existing medical record
     */
    async updateRecord(id: string, recordData: Partial<MedicalRecord>): Promise<void> {
        const recordDoc = doc(this.firestore, 'medicalRecords', id);

        const updateData = { ...recordData };

        // Remove fields that shouldn't be updated
        delete (updateData as any).id;
        delete (updateData as any).createdAt;
        delete (updateData as any).veterinaryId;

        await updateDoc(recordDoc, updateData);

        // Invalidate cache
        this.refreshRecords().subscribe();
    }

    /**
     * Delete a medical record
     */
    async deleteRecord(id: string): Promise<void> {
        const recordDoc = doc(this.firestore, 'medicalRecords', id);
        await deleteDoc(recordDoc);

        // Invalidate cache
        this.refreshRecords().subscribe();
    }

    /**
     * Get records count for statistics
     */
    getRecordsCount(): Observable<number> {
        return new Observable(observer => {
            this.getMedicalRecords().subscribe(
                records => observer.next(records.length),
                error => observer.error(error)
            );
        });
    }

    /**
     * Calculate total cost of prescriptions in a record
     */
    calculatePrescriptionTotal(prescriptions: Prescription[]): number {
        return prescriptions.reduce((total, prescription) => {
            return total + (prescription.price || 0);
        }, 0);
    }
}
