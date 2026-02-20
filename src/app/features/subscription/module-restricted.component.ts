import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

const MODULE_NAMES: Record<string, { name: string; icon: string; description: string; features: string[] }> = {
    appointments: {
        name: 'Turnos',
        icon: 'event',
        description: 'Gestioná los turnos del día a día, agendá por orden de llegada y consultá el historial de cada mascota antes de que entre.',
        features: ['Agenda del día en tiempo real', 'Registro de turno al llegar', 'Vista rápida de historial médico', 'Estados: Esperando / En atención / Atendido']
    },
    grooming: {
        name: 'Peluquería Canina',
        icon: 'content_cut',
        description: 'Gestioná los servicios de peluquería, precios y agenda de grooming.',
        features: ['Catálogo de servicios', 'Agenda de grooming', 'Historial de cortes', 'Precios por raza y tamaño']
    },
    inventory: {
        name: 'Inventario',
        icon: 'inventory',
        description: 'Controlá el stock de medicamentos, insumos y productos.',
        features: ['Stock en tiempo real', 'Alertas de bajo stock', 'Historial de movimientos', 'Integración con historiales']
    }
};

@Component({
    selector: 'app-module-restricted',
    standalone: true,
    imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule],
    template: `
        <div class="restricted-container">
            <mat-card class="restricted-card">
                <div class="module-icon">
                    <mat-icon>{{ module?.icon || 'lock' }}</mat-icon>
                </div>

                <h2>Módulo no activado</h2>

                @if (module) {
                    <p class="description">{{ module.description }}</p>
                    <ul class="features">
                        @for (f of module.features; track f) {
                            <li><mat-icon>check_circle</mat-icon> {{ f }}</li>
                        }
                    </ul>
                }

                <div class="actions">
                    <button mat-button routerLink="/dashboard">
                        <mat-icon>arrow_back</mat-icon> Volver al inicio
                    </button>
                    <button mat-raised-button color="primary" routerLink="/dashboard/settings">
                        <mat-icon>rocket_launch</mat-icon> Ver planes y activar
                    </button>
                </div>
            </mat-card>
        </div>
    `,
    styles: [`
        .restricted-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100%;
            padding: 2rem;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        }
        .restricted-card {
            max-width: 520px;
            width: 100%;
            padding: 2.5rem;
            text-align: center;
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,.08);
        }
        .module-icon {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
        }
        .module-icon mat-icon {
            font-size: 36px;
            width: 36px;
            height: 36px;
            color: white;
        }
        h2 { margin: 0 0 0.75rem; font-size: 1.5rem; font-weight: 700; color: #212529; }
        .description { color: #6c757d; margin-bottom: 1.5rem; line-height: 1.6; }
        .features {
            list-style: none;
            padding: 0;
            margin: 0 0 2rem;
            text-align: left;
        }
        .features li {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 0;
            color: #495057;
        }
        .features mat-icon { color: #28a745; font-size: 18px; width: 18px; height: 18px; }
        .actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    `]
})
export class ModuleRestrictedComponent implements OnInit {
    private route = inject(ActivatedRoute);
    module?: typeof MODULE_NAMES[string];

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            const key = params['module'];
            this.module = MODULE_NAMES[key];
        });
    }
}
