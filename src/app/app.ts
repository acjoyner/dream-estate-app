import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Firebase } from './services/firebase'; // Real service
import { Subscription } from 'rxjs';
import { NgIf, AsyncPipe, CommonModule } from '@angular/common';

// Import standalone components
import { MediaUpload } from './media-upload/media-upload';
import { MediaDisplay } from './media-display/media-display';
import { Login } from './auth/login/login';
import { Signup } from './auth/signup/signup';
import { Profile } from './profile/profile';
import { Friends } from './friends/friends'; // New: Import Friends component

// Angular Material Components for the header
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AdminPanel } from "./admin-panel/admin-panel";

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, NgIf, AsyncPipe,
    MatToolbarModule, MatButtonModule, MatIconModule,
    MediaUpload, MediaDisplay, CommonModule,
    Login, Signup, Profile, Friends, // New: Import Friends component
    AdminPanel
]
})
export class App implements OnInit, OnDestroy {
  title = 'DreamEstate';
  activeView: 'upload' | 'display' | 'login' | 'signup' | 'profile' | 'friends' | 'admin' = 'login'; // Added 'friends', 'admin'
  currentUserId: string | null = null;
  isServiceReady: boolean = false;
  userProfilePictureUrl: string | null = null;
  isAdmin: boolean = false; // New: Tracks admin status

  private userIdSubscription: Subscription | undefined;
  private isReadySubscription: Subscription | undefined;
  private profilePictureSubscription: Subscription | undefined;
  private isAdminSubscription: Subscription | undefined; // New subscription

  constructor(public firebaseService: Firebase) {}

  ngOnInit(): void {
    this.userIdSubscription = this.firebaseService.userId$.subscribe(userId => {
      this.currentUserId = userId;
      if (userId && (this.activeView === 'login' || this.activeView === 'signup')) {
        this.activeView = 'upload';
      } else if (!userId && (this.activeView === 'upload' || this.activeView === 'display' || this.activeView === 'profile' || this.activeView === 'friends' || this.activeView === 'admin')) {
        this.activeView = 'login';
      }
    });
    this.isReadySubscription = this.firebaseService.isReady$.subscribe(isReady => {
      this.isServiceReady = isReady;
    });
    this.profilePictureSubscription = this.firebaseService.currentUserProfilePictureUrl$.subscribe(url => {
      this.userProfilePictureUrl = url;
    });
    this.isAdminSubscription = this.firebaseService.isAdmin$.subscribe(isAdmin => { // New: Subscribe to admin status
      this.isAdmin = isAdmin;
    });
  }

  ngOnDestroy(): void {
    this.userIdSubscription?.unsubscribe();
    this.isReadySubscription?.unsubscribe();
    this.profilePictureSubscription?.unsubscribe();
    this.isAdminSubscription?.unsubscribe(); // New: Unsubscribe
  }

  changeView(view: 'upload' | 'display' | 'login' | 'signup' | 'profile' | 'friends' | 'admin'): void { // Added 'friends', 'admin'
    this.activeView = view;
  }

  async onLogout(): Promise<void> {
    await this.firebaseService.logout().toPromise();
    this.changeView('login');
  }
}