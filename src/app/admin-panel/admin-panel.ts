import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firebase } from '../services/firebase';
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { NgIf, NgFor, AsyncPipe, NgClass } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box';

interface AdminUserDisplay {
  uid: string;
  email: string;
  displayName: string;
  profilePictureUrl?: string;
  role: 'user' | 'admin';
}

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss'],
  standalone: true,
  imports: [
    NgIf, NgFor, AsyncPipe,
    MatCardModule, MatButtonModule, MatIconModule, MatListModule,NgClass,
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
    // Ensure only admins can access this content
    this.isAdminSubscription = this.firebaseService.isAdmin$.subscribe(isAdmin => {
      this.isAdmin = isAdmin;
      if (isAdmin) {
        this.loadAllUsers();
      } else {
        this.message = "You do not have administrative privileges.";
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
      next: (users) => {
        this.allUsers = users;
        this.isLoading = false;
        console.log("Admin Panel: All users loaded:", users);
      },
      error: (err) => {
        console.error("Admin Panel: Error loading users:", err);
        this.message = `Error loading users: ${err.message}`;
        this.showMessageBox = true;
        this.isLoading = false;
      }
    });
  }

  // --- Admin Actions (Conceptual - requires Cloud Functions for user deletion) ---

  /**
   * Placeholder for deleting another user.
   * In a real app, this would trigger a Firebase Cloud Function.
   */
  deleteUserAsAdmin(uid: string, email: string): void {
    this.message = `Admin: Attempting to delete user ${email} (UID: ${uid})...`;
    this.showMessageBox = true;
    console.warn(`Admin action: Delete user ${uid} (This requires a Firebase Cloud Function for actual Auth deletion!)`);

    // Example: Call a Cloud Function (pseudo-code)
    // from(httpsCallable(functions, 'deleteUserByAdmin')({ uid: uid })).subscribe({
    //   next: () => { this.message = `User ${email} deleted successfully via Admin Function.`; this.showMessageBox = true; },
    //   error: (err) => { this.message = `Failed to delete user: ${err.message}`; this.showMessageBox = true; }
    // });
  }

  /**
   * Changes a user's role.
   * Admin must have write access to other user profiles in Firestore (enforced by rules).
   */
  changeUserRole(uid: string, newRole: 'user' | 'admin'): void {
    if (!confirm(`Are you sure you want to change role of ${uid} to ${newRole}?`)) {
      return;
    }
    this.message = ''; this.showMessageBox = false;
    this.firebaseService.updateUserProfile(uid, { role: newRole }).subscribe({
      next: () => {
        this.message = `User ${uid} role changed to ${newRole}.`;
        this.showMessageBox = true;
      },
      error: (err) => {
        this.message = `Failed to change role: ${err.message}`;
        this.showMessageBox = true;
        console.error('Change role failed:', err);
      }
    });
  }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }
}