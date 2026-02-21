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
import { Observable, BehaviorSubject, of, throwError, TimeoutError, firstValueFrom } from 'rxjs';
import { switchMap, take, map, filter, tap, timeout, catchError } from 'rxjs/operators';
import { Client } from '../models';
import { AuthService } from '../auth/auth.service';

@Injectable({
    providedIn: 'root'
})
export class ClientService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);
    private injector = inject(Injector);

    // Cache
    private clientsCache$ = new BehaviorSubject<Client[] | null>(null);
    private cacheLoaded = false;

    /**
   * Get all clients for the current user's veterinary (with cache)
   */
    getClients(): Observable<Client[]> {
        // If cache is loaded, return cached data
        if (this.cacheLoaded && this.clientsCache$.value !== null) {
            console.log('[ClientService] Returning cached clients');
            return of(this.clientsCache$.value);
        }

        // Otherwise, load from Firestore
        console.log('[ClientService] Loading clients from Firestore');
        return this.loadClientsFromFirestore();
    }

    /**
     * Load clients from Firestore and update cache
     */
    private loadClientsFromFirestore(): Observable<Client[]> {
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap(currentUser => {
                if (!currentUser?.veterinaryId) {
                    console.warn('[ClientService] No veterinaryId found for current user');
                    return of([]);
                }

                const clientsCol = collection(this.firestore, `veterinaries/${currentUser.veterinaryId}/clients`);
                const q = query(
                    clientsCol,
                    orderBy('createdAt', 'desc')
                );

                return runInInjectionContext(this.injector, () => collectionData(q, { idField: 'id' })).pipe(
                    timeout(1000),
                    catchError((err) => {
                        if (err instanceof TimeoutError) {
                            console.warn('[ClientService] Firestore data load timed out, returning empty array.');
                            return of([]);
                        }
                        return throwError(() => err);
                    }),
                    take(1),
                    map(data => data as Client[]),
                    tap(clients => {
                        console.log('[ClientService] Loaded', clients.length, 'clients from Firestore');
                        this.clientsCache$.next(clients);
                        this.cacheLoaded = true;
                    })
                );
            })
        );
    }

    /**
     * Refresh cache by reloading from Firestore
     */
    refreshClients(): Observable<Client[]> {
        console.log('[ClientService] Refreshing clients cache');
        this.cacheLoaded = false;
        return this.loadClientsFromFirestore();
    }

    /**
     * Search clients by name, email, or phone
     */
    searchClients(searchTerm: string): Observable<Client[]> {
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap(currentUser => {
                if (!currentUser?.veterinaryId) {
                    return new Observable<Client[]>(observer => {
                        observer.next([]);
                        observer.complete();
                    });
                }

                const clientsCol = collection(this.firestore, `veterinaries/${currentUser.veterinaryId}/clients`);
                const q = query(
                    clientsCol
                );

                return collectionData(q, { idField: 'id' }).pipe(
                    map(clients => {
                        const filtered = (clients as Client[]).filter(client => {
                            const term = searchTerm.toLowerCase();
                            return (
                                client.firstName?.toLowerCase().includes(term) ||
                                client.lastName?.toLowerCase().includes(term) ||
                                client.email?.toLowerCase().includes(term) ||
                                client.phone?.includes(searchTerm)
                            );
                        });
                        return filtered;
                    })
                );
            })
        );
    }

    /**
     * Get a single client by ID
     */
    getClientById(id: string): Observable<Client | undefined> {
        return this.authService.currentUser$.pipe(
            take(1),
            switchMap(currentUser => {
                if (!currentUser?.veterinaryId) {
                    return of(undefined);
                }
                const clientDocRef = doc(this.firestore, `veterinaries/${currentUser.veterinaryId}/clients`, id);
                return (runInInjectionContext(this.injector, () => docData(clientDocRef, { idField: 'id' })) as Observable<Client | undefined>).pipe(
                    take(1),
                    timeout(2500),
                    catchError(() => of(undefined))
                );
            })
        );
    }

    /**
   * Create a new client
   */
    async createClient(clientData: Partial<Client>): Promise<string> {
        const currentUser = await this.authService.getUserProfile();

        if (!currentUser) {
            throw new Error('User must be logged in to create clients');
        }

        if (!currentUser.veterinaryId) {
            throw new Error('User must have a veterinary assigned. Please contact administrator.');
        }

        const newClient: Omit<Client, 'id'> = {
            veterinaryId: currentUser.veterinaryId,
            branchId: clientData.branchId || '',
            firstName: clientData.firstName || '',
            lastName: clientData.lastName || '',
            email: clientData.email || '',
            phone: clientData.phone || '',
            whatsapp: clientData.whatsapp,
            address: clientData.address || '',
            city: clientData.city || '',
            identificationNumber: clientData.identificationNumber || '',
            notificationPreferences: clientData.notificationPreferences || {
                email: true,
                sms: false,
                whatsapp: false
            },
            loyaltyPoints: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        const clientsCol = collection(this.firestore, `veterinaries/${currentUser.veterinaryId}/clients`);
        const docRef = await addDoc(clientsCol, newClient);

        // Invalidate cache
        this.refreshClients().subscribe();

        return docRef.id;
    }

    /**
     * Update an existing client
     */
    async updateClient(id: string, clientData: Partial<Client>): Promise<void> {
        const currentUser = await firstValueFrom(this.authService.currentUser$);
        if (!currentUser?.veterinaryId) {
            throw new Error('No veterinary assigned');
        }

        const clientDoc = doc(this.firestore, `veterinaries/${currentUser.veterinaryId}/clients`, id);

        const updateData = {
            ...clientData,
            updatedAt: Timestamp.now()
        };

        // Remove id from update data if present
        delete (updateData as any).id;
        delete (updateData as any).createdAt;
        delete (updateData as any).veterinaryId;

        await updateDoc(clientDoc, updateData);

        // Invalidate cache
        this.refreshClients().subscribe();
    }

    /**
     * Delete a client
     */
    async deleteClient(id: string): Promise<void> {
        const currentUser = await firstValueFrom(this.authService.currentUser$);
        if (!currentUser?.veterinaryId) {
            throw new Error('No veterinary assigned');
        }

        const clientDoc = doc(this.firestore, `veterinaries/${currentUser.veterinaryId}/clients`, id);
        await deleteDoc(clientDoc);

        // Invalidate cache
        this.refreshClients().subscribe();
    }

    /**
     * Get clients count for statistics
     */
    getClientsCount(): Observable<number> {
        return new Observable(observer => {
            this.getClients().subscribe(
                clients => observer.next(clients.length),
                error => observer.error(error)
            );
        });
    }
}
