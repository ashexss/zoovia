import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { map } from 'rxjs/operators';

/**
 * Guard to protect routes that require authentication
 */
export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.user$.pipe(
        map(user => {
            if (user) {
                return true;
            } else {
                router.navigate(['/login']);
                return false;
            }
        })
    );
};

/**
 * Guard to redirect authenticated users away from login page
 */
export const loginGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.user$.pipe(
        map(user => {
            if (user) {
                router.navigate(['/dashboard']);
                return false;
            } else {
                return true;
            }
        })
    );
};

/**
 * Guard for the public landing page — redirect authenticated users to dashboard
 */
export const landingGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.user$.pipe(
        map(user => {
            if (user) {
                router.navigate(['/dashboard']);
                return false;
            }
            return true;
        })
    );
};
