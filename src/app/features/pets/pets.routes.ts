import { Routes } from '@angular/router';

export const PETS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('./pets-list.component').then(m => m.PetsListComponent)
    },
    {
        path: 'new',
        loadComponent: () => import('./pet-form.component').then(m => m.PetFormComponent)
    },
    {
        path: ':id/edit',
        loadComponent: () => import('./pet-form.component').then(m => m.PetFormComponent)
    }
];
