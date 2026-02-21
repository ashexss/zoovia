import { Routes } from '@angular/router';
import { authGuard, loginGuard, landingGuard } from './core/guards/auth.guard';
import { moduleAccessGuard } from './core/guards/module-access.guard';
import { superadminGuard } from './core/guards/superadmin.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent),
        canActivate: [landingGuard]
    },
    {
        path: 'login',
        loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
        canActivate: [loginGuard]
    },
    {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [authGuard],
        children: [
            {
                path: '',
                loadComponent: () => import('./features/dashboard/dashboard-home.component').then(m => m.DashboardHomeComponent)
            },
            {
                path: 'clients',
                loadChildren: () => import('./features/clients/clients.routes').then(m => m.CLIENTS_ROUTES)
            },
            {
                path: 'pets',
                loadChildren: () => import('./features/pets/pets.routes').then(m => m.PETS_ROUTES)
            },
            {
                path: 'medical-records',
                loadChildren: () => import('./features/medical-records/medical-records.routes').then(m => m.MEDICAL_RECORDS_ROUTES)
            },
            {
                path: 'settings',
                loadComponent: () => import('./features/settings/veterinary-settings.component').then(m => m.VeterinarySettingsComponent)
            },
            // Module-guarded routes (guard ensures module is active in subscription)
            {
                path: 'appointments',
                canActivate: [moduleAccessGuard],
                data: { requiredModule: 'appointments' },
                loadChildren: () => import('./features/appointments/appointments.routes').then(m => m.APPOINTMENTS_ROUTES)
            },
            {
                path: 'grooming',
                canActivate: [moduleAccessGuard],
                data: { requiredModule: 'grooming' },
                loadComponent: () => import('./features/subscription/module-restricted.component').then(m => m.ModuleRestrictedComponent)
                // TODO: Replace with real GroomingComponent when module is built
            },
            {
                path: 'inventory',
                canActivate: [moduleAccessGuard],
                data: { requiredModule: 'inventory' },
                loadComponent: () => import('./features/subscription/module-restricted.component').then(m => m.ModuleRestrictedComponent)
                // TODO: Replace with real InventoryComponent when module is built
            },
            // Fallback for restricted modules (no active subscription module)
            {
                path: 'restricted',
                loadComponent: () => import('./features/subscription/module-restricted.component').then(m => m.ModuleRestrictedComponent)
            }
        ]
    },
    {
        path: 'superadmin',
        loadComponent: () => import('./features/superadmin/superadmin-dashboard.component').then(m => m.SuperadminDashboardComponent),
        canActivate: [superadminGuard]
    },
    {
        path: '**',
        redirectTo: '/dashboard'
    }
];
