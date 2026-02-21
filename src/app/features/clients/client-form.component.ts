import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Client } from '../../core/models';
import { ClientService } from '../../core/services';

@Component({
    selector: 'app-client-form',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './client-form.component.html',
    styleUrls: ['./client-form.component.scss']
})
export class ClientFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private clientService = inject(ClientService);
    private cdr = inject(ChangeDetectorRef);

    clientForm!: FormGroup;
    isEditMode = false;
    clientId: string | null = null;
    loading = false;
    saving = false;

    ngOnInit(): void {
        this.initForm();
        this.checkEditMode();
    }

    /**
     * Initialize the form
     */
    initForm(): void {
        this.clientForm = this.fb.group({
            firstName: ['', [Validators.required, Validators.minLength(2)]],
            lastName: ['', [Validators.required, Validators.minLength(2)]],
            email: ['', [Validators.required, Validators.email]],
            phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]+$/)]],
            whatsapp: ['', [Validators.pattern(/^[0-9+\-\s()]+$/)]],
            address: [''],
            city: [''],
            identificationNumber: ['', [Validators.required]],
            branchId: [''], // This should be populated from a branch selector in production
            notificationPreferences: this.fb.group({
                email: [true],
                sms: [false],
                whatsapp: [false]
            })
        });
    }

    /**
     * Check if we're in edit mode and load client data
     */
    checkEditMode(): void {
        this.clientId = this.route.snapshot.paramMap.get('id');
        if (this.clientId) {
            this.isEditMode = true;
            this.loadClient(this.clientId);
        }
    }

    /**
     * Load client data for editing
     */
    loadClient(id: string): void {
        this.loading = true;
        this.clientService.getClientById(id).subscribe({
            next: (client) => {
                if (client) {
                    this.clientForm.patchValue(client);
                }
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Error loading client:', error);
                this.loading = false;
                this.cdr.detectChanges();
                alert('Error al cargar el cliente');
                this.router.navigate(['/dashboard/clients']);
            }
        });
    }

    /**
     * Submit the form
     */
    async onSubmit(): Promise<void> {
        if (this.clientForm.invalid) {
            this.clientForm.markAllAsTouched();
            return;
        }

        this.saving = true;

        try {
            const clientData: Partial<Client> = this.clientForm.value;

            if (this.isEditMode && this.clientId) {
                await this.clientService.updateClient(this.clientId, clientData);
                alert('Cliente actualizado exitosamente');
                this.router.navigate(['/dashboard/clients', this.clientId]);
            } else {
                const newClientId = await this.clientService.createClient(clientData);
                alert('Cliente creado exitosamente');
                // Navigate to client detail instead of list
                this.router.navigate(['/dashboard/clients', newClientId]);
            }
        } catch (error) {
            console.error('Error saving client:', error);
            alert('Error al guardar el cliente: ' + (error as Error).message);
        } finally {
            this.saving = false;
        }
    }

    /**
     * Cancel and go back
     */
    onCancel(): void {
        this.router.navigate(['/dashboard/clients']);
    }

    /**
     * Get error message for a field
     */
    getErrorMessage(fieldName: string): string {
        const field = this.clientForm.get(fieldName);
        if (!field) return '';

        if (field.hasError('required')) {
            return 'Este campo es requerido';
        }
        if (field.hasError('email')) {
            return 'Email inválido';
        }
        if (field.hasError('minlength')) {
            const minLength = field.getError('minlength').requiredLength;
            return `Mínimo ${minLength} caracteres`;
        }
        if (field.hasError('pattern')) {
            return 'Formato inválido';
        }
        if (fieldName === 'identificationNumber' && field.hasError('required')) {
            return 'El DNI es requerido';
        }
        return '';
    }
}
