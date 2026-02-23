import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { VeterinaryService, NavigationService, MenuItem } from '../../core/services';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatToolbarModule,
        MatSidenavModule,
        MatListModule,
        MatIconModule,
        MatButtonModule,
        MatMenuModule
    ],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
    private authService = inject(AuthService);
    private veterinaryService = inject(VeterinaryService);
    private navigationService = inject(NavigationService);
    private router = inject(Router);

    currentUser$ = this.authService.currentUser$;
    veterinary$ = this.veterinaryService.getCurrentVeterinary();
    menuItems$: Observable<MenuItem[]> | undefined;

    currentDate = new Date();
    private timerInterval: any;

    ngOnInit() {
        this.menuItems$ = this.navigationService.getMenuItems();
        // Update time every minute
        this.timerInterval = setInterval(() => {
            this.currentDate = new Date();
        }, 60000);
    }

    ngOnDestroy() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }

    get formattedDate(): string {
        return this.currentDate.toLocaleDateString('es-AR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    get formattedTime(): string {
        return this.currentDate.toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit'
        });
    }

    async logout(): Promise<void> {
        await this.authService.signOut();
        this.router.navigate(['/login']);
    }
}
