import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    loginForm: FormGroup;
    loading = false;
    errorMessage = '';
    hidePassword = true;

    constructor() {
        this.loginForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]]
        });
    }

    async onSubmit(): Promise<void> {
        if (this.loginForm.invalid) {
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        try {
            const { email, password } = this.loginForm.value;
            await this.authService.signIn(email, password);
            this.router.navigate(['/dashboard']);
        } catch (error: any) {
            this.errorMessage = this.getErrorMessage(error);
        } finally {
            this.loading = false;
        }
    }

    private getErrorMessage(error: any): string {
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                return 'Email o contraseña incorrectos';
            case 'auth/invalid-email':
                return 'Email inválido';
            case 'auth/user-disabled':
                return 'Usuario deshabilitado';
            case 'auth/too-many-requests':
                return 'Demasiados intentos fallidos. Intente más tarde';
            default:
                return 'Error al iniciar sesión. Intente nuevamente';
        }
    }
}
