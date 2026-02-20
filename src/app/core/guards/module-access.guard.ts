import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { VeterinaryService } from '../services/veterinary.service';
import { SubscriptionModules } from '../models/subscription';

/**
 * Guard that checks if the current veterinary has the required module active.
 * Routes must supply `data: { requiredModule: keyof SubscriptionModules }`.
 */
export const moduleAccessGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
    const veterinaryService = inject(VeterinaryService);
    const router = inject(Router);

    const requiredModule = route.data['requiredModule'] as keyof SubscriptionModules;

    return veterinaryService.getCurrentVeterinary().pipe(
        take(1),
        map(vet => {
            if (!vet || !vet.subscription) {
                // No subscription data — allow for now (migration period)
                return true;
            }

            const hasModule = vet.subscription.modules[requiredModule] === true;

            if (!hasModule) {
                router.navigate(['/dashboard/restricted'], {
                    queryParams: { module: requiredModule }
                });
                return false;
            }

            return true;
        })
    );
};
