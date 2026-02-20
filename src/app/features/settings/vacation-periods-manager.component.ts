import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatListModule } from '@angular/material/list';

import { VacationPeriod } from '../../core/models';

@Component({
    selector: 'app-vacation-periods-manager',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatListModule
    ],
    templateUrl: './vacation-periods-manager.component.html',
    styleUrls: ['./vacation-periods-manager.component.scss']
})
export class VacationPeriodsManagerComponent {
    @Input() vacationPeriods: VacationPeriod[] = [];
    @Output() vacationPeriodsChange = new EventEmitter<VacationPeriod[]>();

    private fb = new FormBuilder();

    vacationForm: FormGroup;
    isAdding = false;

    constructor() {
        this.vacationForm = this.fb.group({
            startDate: ['', Validators.required],
            endDate: ['', Validators.required],
            reason: ['', Validators.required]
        });
    }

    startAdding(): void {
        this.isAdding = true;
        this.vacationForm.reset();
    }

    cancelAdding(): void {
        this.isAdding = false;
        this.vacationForm.reset();
    }

    addVacationPeriod(): void {
        if (this.vacationForm.valid) {
            const startDate = this.vacationForm.value.startDate as Date;
            const endDate = this.vacationForm.value.endDate as Date;

            // Validate end date is after start date
            if (endDate <= startDate) {
                return;
            }

            const newPeriod: VacationPeriod = {
                startDate: this.formatDate(startDate),
                endDate: this.formatDate(endDate),
                reason: this.vacationForm.value.reason
            };

            const updatedPeriods = [...this.vacationPeriods, newPeriod];
            this.vacationPeriodsChange.emit(updatedPeriods);

            this.isAdding = false;
            this.vacationForm.reset();
        }
    }

    removeVacationPeriod(index: number): void {
        const updatedPeriods = this.vacationPeriods.filter((_, i) => i !== index);
        this.vacationPeriodsChange.emit(updatedPeriods);
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatDisplayDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    calculateDuration(period: VacationPeriod): number {
        const start = new Date(period.startDate);
        const end = new Date(period.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1; // Include both start and end days
    }

    isDateRangeValid(): boolean {
        const startDate = this.vacationForm.get('startDate')?.value;
        const endDate = this.vacationForm.get('endDate')?.value;

        if (!startDate || !endDate) {
            return true; // Don't show error if fields are empty
        }

        return endDate > startDate;
    }
}
