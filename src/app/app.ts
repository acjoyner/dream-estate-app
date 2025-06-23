import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Firebase } from './services/firebase';
import { Subscription } from 'rxjs';
import { NgIf, AsyncPipe } from '@angular/common';

// Import standalone components
import { MediaUpload } from './media-upload/media-upload';
import { MediaDisplay } from './media-display/media-display';
import { Login } from './auth/login/login';
import { Signup } from './auth/signup/signup';
import { Profile } from './profile/profile';
import { Friends } from './friends/friends';
import { AdminPanel } from './admin-panel/admin-panel';
import { HelpfulLinks } from './helpful-links/helpful-links'; // New: HelpfulLinksComponent

// Angular Material Components for the header
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, NgIf, AsyncPipe,MatToolbarModule, MatButtonModule, MatIconModule,
    MediaUpload, MediaDisplay,Login, Signup, Profile,Friends, AdminPanel, // Existing new components
    HelpfulLinks // New: Add HelpfulLinksComponent
  ]
})
export class App implements OnInit, OnDestroy {
  title = 'DreamEstate';
  // Added 'resources' to activeView types
  activeView: 'upload' | 'display' | 'login' | 'signup' | 'profile' | 'friends' | 'admin' | 'resources' = 'login';
  currentUserId: string | null = null;
  isServiceReady: boolean = false;
  userProfilePictureUrl: string | null = null;
  isAdmin: boolean = false;

  private userIdSubscription: Subscription | undefined;
  private isReadySubscription: Subscription | undefined;
  private profilePictureSubscription: Subscription | undefined;
  private isAdminSubscription: Subscription | undefined;

  constructor(public firebaseService: Firebase) {}

  ngOnInit(): void {
    this.userIdSubscription = this.firebaseService.userId$.subscribe(userId => {
      this.currentUserId = userId;
      if (userId && (this.activeView === 'login' || this.activeView === 'signup')) {
        this.activeView = 'upload';
      } else if (!userId && (this.activeView === 'upload' || this.activeView === 'display' || this.activeView === 'profile' || this.activeView === 'friends' || this.activeView === 'admin' || this.activeView === 'resources')) { // Added 'resources'
        this.activeView = 'login';
      }
    });
    this.isReadySubscription = this.firebaseService.isReady$.subscribe(isReady => {
      this.isServiceReady = isReady;
    });
    this.profilePictureSubscription = this.firebaseService.currentUserProfilePictureUrl$.subscribe(url => {
      this.userProfilePictureUrl = url;
    });
    this.isAdminSubscription = this.firebaseService.isAdmin$.subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });
  }

  ngOnDestroy(): void {
    this.userIdSubscription?.unsubscribe();
    this.isReadySubscription?.unsubscribe();
    this.profilePictureSubscription?.unsubscribe();
    this.isAdminSubscription?.unsubscribe();
  }

  // Added 'resources' to changeView types
  changeView(view: 'upload' | 'display' | 'login' | 'signup' | 'profile' | 'friends' | 'admin' | 'resources'): void {
    this.activeView = view;
  }

  async onLogout(): Promise<void> {
    await this.firebaseService.logout().toPromise();
    this.changeView('login');
  }
}