import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firebase, UserProfile } from '../services/firebase'; // <--- Import UserProfile
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { NgIf, NgFor, AsyncPipe, NgClass } from '@angular/common'; // NgClass for role highlighting
import { MessageBox } from '../shared/message-box/message-box';

// FIX: AdminUserDisplay interface - keeping role as non-optional, so it must be defaulted in mapping
interface AdminUserDisplay {
  uid: string;
  email: string;
  displayName: string;
  profilePictureUrl?: string;
  role: 'user' | 'admin'; // Keeping this as non-optional requires explicit defaulting
}

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss'],
  standalone: true,
  imports: [
    NgIf, NgFor, AsyncPipe, NgClass, // NgClass needed for role highlighting
    MatCardModule, MatButtonModule, MatIconModule, MatListModule,
    MessageBox
  ]
})
export class AdminPanel implements OnInit, OnDestroy {
  allUsers: AdminUserDisplay[] = [];
  isLoading: boolean = true;
  message: string = '';
  showMessageBox: boolean = false;

  private usersSubscription: Subscription | undefined;
  private isAdminSubscription: Subscription | undefined;
  isAdmin: boolean = false; // Local state for admin check

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void {
    this.isAdminSubscription = this.firebaseService.isAdmin$.subscribe(isAdmin => {
      this.isAdmin = isAdmin;
      if (isAdmin) {
        this.loadAllUsers();
      } else {
        this.message = "Access Denied. You do not have administrative privileges.";
        this.showMessageBox = true;
        this.isLoading = false;
        this.allUsers = []; // Clear user list if not admin
      }
    });
  }

  ngOnDestroy(): void {
    this.usersSubscription?.unsubscribe();
    this.isAdminSubscription?.unsubscribe();
  }

  loadAllUsers(): void {
    this.isLoading = true;
    this.message = '';
    this.showMessageBox = false;

    this.usersSubscription = this.firebaseService.getAllUserProfiles().subscribe({
      next: (users: UserProfile[]) => { // Type users array as UserProfile[]
        // FIX: Map UserProfile to AdminUserDisplay, explicitly defaulting 'role'
        this.allUsers = users.map(user => ({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          profilePictureUrl: user.profilePictureUrl,
          role: user.role || 'user' // CRITICAL: Provide a default if role is undefined
        } as AdminUserDisplay)); // Explicitly cast to AdminUserDisplay
        this.isLoading = false;
        console.log("Admin Panel: All users loaded:", this.allUsers);
      },
      error: (err) => {
        console.error("Admin Panel: Error loading users:", err);
        this.message = `Error loading users: ${err.message}`;
        this.showMessageBox = true;
        this.isLoading = false;
      }
    });
  }

  deleteUserAsAdmin(uid: string, email: string): void { /* ... */ }
  changeUserRole(uid: string, newRole: 'user' | 'admin'): void { /* ... */ }
  closeMessageBox(): void { /* ... */ }
}