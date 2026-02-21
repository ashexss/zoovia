import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
    Auth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    user,
    User as FirebaseUser
} from '@angular/fire/auth';
import {
    Firestore,
    doc,
    docData,
    getDoc,
    setDoc,
    Timestamp
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { User } from '../models';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth = inject(Auth);
    private firestore = inject(Firestore);
    private injector = inject(Injector);

    // Observable of the current Firebase user
    user$ = user(this.auth);

    // Observable of the current user with full profile data
    currentUser$: Observable<User | null> = this.user$.pipe(
        switchMap((firebaseUser: FirebaseUser | null) => {
            if (!firebaseUser) {
                return of(null);
            }
            // Use docData instead of async getDoc to stay in injection context
            const userDocRef = doc(this.firestore, 'users', firebaseUser.uid);
            return runInInjectionContext(this.injector, () => docData(userDocRef, { idField: 'id' })).pipe(
                map(data => data as User | undefined),
                map(user => user || null)
            );
        })
    );

    /**
     * Sign in with email and password
     */
    async signIn(email: string, password: string): Promise<void> {
        try {
            await signInWithEmailAndPassword(this.auth, email, password);
        } catch (error) {
            console.error('Error signing in:', error);
            throw error;
        }
    }

    /**
     * Create a new user account
     */
    async signUp(
        email: string,
        password: string,
        displayName: string,
        role: User['role'] = 'assistant',
        veterinaryId?: string
    ): Promise<void> {
        try {
            const credential = await createUserWithEmailAndPassword(this.auth, email, password);

            // For MVP, use default veterinary if not provided
            // In production, this should be selected during onboarding
            const assignedVeterinaryId = veterinaryId || 'vet-default-001';

            // Create user profile in Firestore
            const userProfile: User = {
                id: credential.user.uid,
                email: email,
                displayName: displayName,
                role: role,
                veterinaryId: assignedVeterinaryId,
                createdAt: Timestamp.now(),
                lastLogin: Timestamp.now()
            };

            await setDoc(doc(this.firestore, 'users', credential.user.uid), userProfile);
        } catch (error) {
            console.error('Error signing up:', error);
            throw error;
        }
    }

    /**
     * Sign out the current user
     */
    async signOut(): Promise<void> {
        try {
            await signOut(this.auth);
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    }

    /**
     * Get user profile from Firestore
     */
    async getUserProfile(uid?: string): Promise<User | null> {
        try {
            const userId = uid || this.auth.currentUser?.uid;
            if (!userId) return null;

            const userDoc = await runInInjectionContext(this.injector, () => getDoc(doc(this.firestore, 'users', userId)));
            if (userDoc.exists()) {
                return userDoc.data() as User;
            }
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.auth.currentUser !== null;
    }

    /**
     * Get current user ID
     */
    getCurrentUserId(): string | null {
        return this.auth.currentUser?.uid || null;
    }
}
