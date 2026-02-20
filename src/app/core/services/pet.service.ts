import { Injectable, inject } from '@angular/core';
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
import { Observable, BehaviorSubject, of } from 'rxjs';
import { switchMap, take, map, tap } from 'rxjs/operators';
import { Pet } from '../models';
import { AuthService } from '../auth/auth.service';

@Injectable({
    providedIn: 'root'
})
export class PetService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);

    // Cache
    private petsCache$ = new BehaviorSubject<Pet[] | null>(null);
    private cacheLoaded = false;

    /**
     * Get all pets for the current user's veterinary (with cache)
     */
    getPets(): Observable<Pet[]> {
        // If cache is loaded, return cached data
        if (this.cacheLoaded && this.petsCache$.value !== null) {
            console.log('[PetService] Returning cached pets');
            return of(this.petsCache$.value);
        }

        // Otherwise, load from Firestore
        console.log('[PetService] Loading pets from Firestore');
        return this.loadPetsFromFirestore();
    }

    /**
     * Load pets from Firestore and update cache
     */
    private loadPetsFromFirestore(): Observable<Pet[]> {
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap(currentUser => {
                if (!currentUser?.veterinaryId) {
                    return of([]);
                }

                const petsCol = collection(this.firestore, 'pets');
                const q = query(
                    petsCol,
                    where('veterinaryId', '==', currentUser.veterinaryId),
                    orderBy('createdAt', 'desc')
                );

                return collectionData(q, { idField: 'id' }).pipe(
                    take(1),
                    map(data => data as Pet[]),
                    tap(pets => {
                        console.log('[PetService] Loaded', pets.length, 'pets from Firestore');
                        this.petsCache$.next(pets);
                        this.cacheLoaded = true;
                    })
                );
            })
        );
    }

    /**
     * Refresh cache by reloading from Firestore
     */
    refreshPets(): Observable<Pet[]> {
        console.log('[PetService] Refreshing pets cache');
        this.cacheLoaded = false;
        return this.loadPetsFromFirestore();
    }

    /**
     * Get pets by client ID
     */
    getPetsByClient(clientId: string): Observable<Pet[]> {
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap(currentUser => {
                if (!currentUser?.veterinaryId) {
                    return new Observable<Pet[]>(observer => {
                        observer.next([]);
                        observer.complete();
                    });
                }

                const petsCol = collection(this.firestore, 'pets');
                const q = query(
                    petsCol,
                    where('veterinaryId', '==', currentUser.veterinaryId),
                    where('clientId', '==', clientId),
                    orderBy('createdAt', 'desc')
                );

                return collectionData(q, { idField: 'id' }) as Observable<Pet[]>;
            })
        );
    }

    /**
     * Search pets by name or microchip
     */
    searchPets(searchTerm: string): Observable<Pet[]> {
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap(currentUser => {
                if (!currentUser?.veterinaryId) {
                    return new Observable<Pet[]>(observer => {
                        observer.next([]);
                        observer.complete();
                    });
                }

                const petsCol = collection(this.firestore, 'pets');
                const q = query(
                    petsCol,
                    where('veterinaryId', '==', currentUser.veterinaryId)
                );

                return collectionData(q, { idField: 'id' }).pipe(
                    map(pets => {
                        const filtered = (pets as Pet[]).filter(pet => {
                            const term = searchTerm.toLowerCase();
                            return (
                                pet.name?.toLowerCase().includes(term) ||
                                pet.breed?.toLowerCase().includes(term) ||
                                pet.microchipNumber?.includes(searchTerm)
                            );
                        });
                        return filtered;
                    })
                );
            })
        );
    }

    /**
     * Get a single pet by ID
     */
    getPetById(id: string): Observable<Pet | undefined> {
        const petDoc = doc(this.firestore, 'pets', id);
        return docData(petDoc, { idField: 'id' }) as Observable<Pet | undefined>;
    }

    /**
     * Create a new pet
     */
    async createPet(petData: Partial<Pet>): Promise<string> {
        const currentUser = await this.authService.getUserProfile();

        if (!currentUser?.veterinaryId) {
            throw new Error('User must belong to a veterinary to create pets');
        }

        if (!petData.clientId) {
            throw new Error('Pet must be associated with a client');
        }

        const newPet: Omit<Pet, 'id'> = {
            veterinaryId: currentUser.veterinaryId,
            clientId: petData.clientId,
            name: petData.name || '',
            species: petData.species || 'dog',
            breed: petData.breed || '',
            gender: petData.gender || 'male',
            birthDate: petData.birthDate || Timestamp.now(),
            weight: petData.weight || 0,
            color: petData.color || '',
            microchipNumber: petData.microchipNumber,
            photo: petData.photo,
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        const petsCol = collection(this.firestore, 'pets');
        const docRef = await addDoc(petsCol, newPet);

        // Invalidate cache
        this.refreshPets().subscribe();

        return docRef.id;
    }

    /**
     * Update an existing pet
     */
    async updatePet(id: string, petData: Partial<Pet>): Promise<void> {
        const petDoc = doc(this.firestore, 'pets', id);

        const updateData = {
            ...petData,
            updatedAt: Timestamp.now()
        };

        // Remove fields that shouldn't be updated
        delete (updateData as any).id;
        delete (updateData as any).createdAt;
        delete (updateData as any).veterinaryId;

        await updateDoc(petDoc, updateData);

        // Invalidate cache
        this.refreshPets().subscribe();
    }

    /**
     * Delete a pet (soft delete - mark as inactive)
     */
    async deletePet(id: string): Promise<void> {
        const petDoc = doc(this.firestore, 'pets', id);
        await updateDoc(petDoc, {
            isActive: false,
            updatedAt: Timestamp.now()
        });

        // Invalidate cache
        this.refreshPets().subscribe();
    }

    /**
     * Permanently delete a pet
     */
    async permanentlyDeletePet(id: string): Promise<void> {
        const petDoc = doc(this.firestore, 'pets', id);
        await deleteDoc(petDoc);
    }

    /**
     * Get pets count for statistics
     */
    getPetsCount(): Observable<number> {
        return new Observable(observer => {
            this.getPets().subscribe(
                pets => observer.next(pets.filter(p => p.isActive).length),
                error => observer.error(error)
            );
        });
    }

    /**
     * Calculate pet age from birthDate
     */
    calculateAge(birthDate: Timestamp): { years: number; months: number } {
        const now = new Date();
        const birth = birthDate.toDate();

        let years = now.getFullYear() - birth.getFullYear();
        let months = now.getMonth() - birth.getMonth();

        if (months < 0) {
            years--;
            months += 12;
        }

        return { years, months };
    }
}
