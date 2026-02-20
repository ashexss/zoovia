import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import { BusinessHours, DaySchedule, BusinessShift } from '../../core/models';

interface DayConfig {
    key: keyof BusinessHours;
    label: string;
}

@Component({
    selector: 'app-business-hours-editor',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSlideToggleModule,
        MatTooltipModule
    ],
    templateUrl: './business-hours-editor.component.html',
    styleUrls: ['./business-hours-editor.component.scss']
})
export class BusinessHoursEditorComponent implements OnInit {
    @Input() businessHours?: BusinessHours;
    @Output() hoursChange = new EventEmitter<BusinessHours>();

    private fb = new FormBuilder();

    hoursForm!: FormGroup;

    daysOfWeek: DayConfig[] = [
        { key: 'monday', label: 'Lunes' },
        { key: 'tuesday', label: 'Martes' },
        { key: 'wednesday', label: 'Miércoles' },
        { key: 'thursday', label: 'Jueves' },
        { key: 'friday', label: 'Viernes' },
        { key: 'saturday', label: 'Sábado' },
        { key: 'sunday', label: 'Domingo' }
    ];

    ngOnInit(): void {
        this.initializeForm();
    }

    private initializeForm(): void {
        const formConfig: any = {};

        this.daysOfWeek.forEach(day => {
            const daySchedule = this.businessHours?.[day.key];

            // Handle both old and new data formats
            let shifts: BusinessShift[] = [];

            if (daySchedule) {
                // Check if it's the new format (has shifts array)
                if ('shifts' in daySchedule && Array.isArray(daySchedule.shifts)) {
                    shifts = daySchedule.shifts;
                }
                // Check if it's the old format (has open/close/closed)
                else if ('open' in daySchedule && 'close' in daySchedule) {
                    const oldFormat = daySchedule as any;
                    // Only add shift if day is not closed
                    if (!oldFormat.closed && oldFormat.open && oldFormat.close) {
                        shifts = [{ open: oldFormat.open, close: oldFormat.close }];
                    }
                }
            }

            formConfig[day.key] = this.fb.group({
                enabled: [shifts.length > 0],
                shifts: this.fb.array(
                    shifts.length > 0
                        ? shifts.map(shift => this.createShiftFormGroup(shift))
                        : [this.createShiftFormGroup()]
                )
            });
        });

        this.hoursForm = this.fb.group(formConfig);

        // Subscribe to form changes
        this.hoursForm.valueChanges.subscribe(() => {
            this.emitChanges();
        });
    }

    private createShiftFormGroup(shift?: BusinessShift): FormGroup {
        return this.fb.group({
            open: [shift?.open || '09:00', Validators.required],
            close: [shift?.close || '19:00', Validators.required]
        });
    }

    getShiftsArray(dayKey: string): FormArray {
        return this.hoursForm.get(dayKey)?.get('shifts') as FormArray;
    }

    isDayEnabled(dayKey: string): boolean {
        return this.hoursForm.get(dayKey)?.get('enabled')?.value || false;
    }

    addShift(dayKey: string): void {
        const shiftsArray = this.getShiftsArray(dayKey);
        shiftsArray.push(this.createShiftFormGroup());
    }

    removeShift(dayKey: string, index: number): void {
        const shiftsArray = this.getShiftsArray(dayKey);
        if (shiftsArray.length > 1) {
            shiftsArray.removeAt(index);
        }
    }

    toggleDay(dayKey: string): void {
        const dayGroup = this.hoursForm.get(dayKey);
        const enabled = dayGroup?.get('enabled')?.value;

        if (!enabled) {
            // If disabling, clear shifts
            const shiftsArray = this.getShiftsArray(dayKey);
            shiftsArray.clear();
            shiftsArray.push(this.createShiftFormGroup());
        }
    }

    private emitChanges(): void {
        const businessHours: BusinessHours = {};

        this.daysOfWeek.forEach(day => {
            const dayValue = this.hoursForm.get(day.key)?.value;

            if (dayValue.enabled && dayValue.shifts.length > 0) {
                businessHours[day.key] = {
                    shifts: dayValue.shifts.filter((shift: BusinessShift) =>
                        shift.open && shift.close
                    )
                };
            }
        });

        this.hoursChange.emit(businessHours);
    }

    validateShiftTimes(dayKey: string, shiftIndex: number): string | null {
        const shiftsArray = this.getShiftsArray(dayKey);
        const shift = shiftsArray.at(shiftIndex).value;

        if (!shift.open || !shift.close) {
            return null;
        }

        // Check if close time is after open time
        if (shift.close <= shift.open) {
            return 'La hora de cierre debe ser posterior a la hora de apertura';
        }

        // Check for overlaps with other shifts
        const allShifts = shiftsArray.value;
        for (let i = 0; i < allShifts.length; i++) {
            if (i === shiftIndex) continue;

            const otherShift = allShifts[i];
            if (!otherShift.open || !otherShift.close) continue;

            // Check if shifts overlap
            if (
                (shift.open >= otherShift.open && shift.open < otherShift.close) ||
                (shift.close > otherShift.open && shift.close <= otherShift.close) ||
                (shift.open <= otherShift.open && shift.close >= otherShift.close)
            ) {
                return 'Los horarios no pueden solaparse';
            }
        }

        return null;
    }
}
