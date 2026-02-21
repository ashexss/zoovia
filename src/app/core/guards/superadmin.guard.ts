import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { map, take } from 'rxjs/operators';

/**
 * Guard that restricts access to routes only for users with role 'superadmin'.
 * Redirects everyone else to /dashboard.
 */
export const superadminGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.currentUser$.pipe(
        take(1),
        map(user => {
            if (user?.role === 'superadmin') {
                return true;
            }
            router.navigate(['/dashboard']);
            return false;
        })
    );
};
