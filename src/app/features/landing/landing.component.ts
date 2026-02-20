import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, addDoc, Timestamp } from '@angular/fire/firestore';

@Component({
    selector: 'app-landing',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './landing.component.html',
    styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, AfterViewInit {
    private firestore = inject(Firestore);

    // ── Form state ──────────────────────────────────────────────
    lead = { nombre: '', veterinaria: '', whatsapp: '' };
    submitting = false;
    submitted = false;
    submitError = '';

    // ── Navbar ──────────────────────────────────────────────────
    menuOpen = false;
    scrolled = false;

    // ── Testimonials helper (placeholders) ──────────────────────
    testimonials = [
        {
            text: 'Nos ayudó a ordenar todo y el sistema de puntos hizo que muchos clientes vuelvan antes de lo esperado.',
            author: 'Veterinaria independiente',
            location: 'Córdoba'
        },
        {
            text: 'La agenda y el historial digital nos ahorran tiempo todos los días. No me imagino volver a las planillas.',
            author: 'Clínica veterinaria',
            location: 'Nueva Córdoba'
        },
        {
            text: 'Mis clientes preguntan por sus puntos cuando vienen. Eso solo ya aumentó la frecuencia de visitas.',
            author: 'Veterinaria independiente',
            location: 'Zona Norte, Córdoba'
        }
    ];

    ngOnInit(): void {
        window.addEventListener('scroll', () => {
            this.scrolled = window.scrollY > 60;
        });
    }

    ngAfterViewInit(): void {
        // Intersection Observer for fade-in animations
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12 }
        );

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }

    scrollTo(id: string): void {
        this.menuOpen = false;
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async submitLead(): Promise<void> {
        if (!this.lead.nombre || !this.lead.whatsapp) return;
        this.submitting = true;
        this.submitError = '';
        try {
            await addDoc(collection(this.firestore, 'demo_leads'), {
                ...this.lead,
                createdAt: Timestamp.now(),
                status: 'new'
            });
            this.submitted = true;
        } catch {
            this.submitError = 'Hubo un error al enviar. Por favor escribinos por WhatsApp.';
        } finally {
            this.submitting = false;
        }
    }
}
