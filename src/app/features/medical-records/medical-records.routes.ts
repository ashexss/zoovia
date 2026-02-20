import { Routes } from '@angular/router';

export const MEDICAL_RECORDS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('./medical-records-list.component').then(m => m.MedicalRecordsListComponent)
    },
    {
        path: 'new',
        loadComponent: () => import('./medical-record-form.component').then(m => m.MedicalRecordFormComponent)
    },
    {
        path: ':id/edit',
        loadComponent: () => import('./medical-record-form.component').then(m => m.MedicalRecordFormComponent)
    }
];
