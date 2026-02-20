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

import { ClosedDate } from '../../core/models';

@Component({
    selector: 'app-closed-dates-manager',
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
    templateUrl: './closed-dates-manager.component.html',
    styleUrls: ['./closed-dates-manager.component.scss']
})
export class ClosedDatesManagerComponent {
    @Input() closedDates: ClosedDate[] = [];
    @Output() closedDatesChange = new EventEmitter<ClosedDate[]>();

    private fb = new FormBuilder();

    closedDateForm: FormGroup;
    isAdding = false;

    constructor() {
        this.closedDateForm = this.fb.group({
            date: ['', Validators.required],
            reason: ['', Validators.required]
        });
    }

    startAdding(): void {
        this.isAdding = true;
        this.closedDateForm.reset();
    }

    cancelAdding(): void {
        this.isAdding = false;
        this.closedDateForm.reset();
    }

    addClosedDate(): void {
        if (this.closedDateForm.valid) {
            const date = this.closedDateForm.value.date as Date;
            const formattedDate = this.formatDate(date);

            const newClosedDate: ClosedDate = {
                date: formattedDate,
                reason: this.closedDateForm.value.reason
            };

            const updatedDates = [...this.closedDates, newClosedDate];
            this.closedDatesChange.emit(updatedDates);

            this.isAdding = false;
            this.closedDateForm.reset();
        }
    }

    removeClosedDate(index: number): void {
        const updatedDates = this.closedDates.filter((_, i) => i !== index);
        this.closedDatesChange.emit(updatedDates);
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    parseDate(dateString: string): Date {
        return new Date(dateString);
    }

    formatDisplayDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }
}
