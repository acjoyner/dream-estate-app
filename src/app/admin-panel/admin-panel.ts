import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firebase, UserProfile } from '../services/firebase'; // Import UserProfile
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list'; // MatListModule if mat-list is used, otherwise remove
import { NgIf, NgFor, AsyncPipe, NgClass } from '@angular/common'; // <--- Ensure NgClass is imported
import { MessageBox } from '../shared/message-box/message-box';
import { MatSnackBar } from '@angular/material/snack-bar';

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
    NgIf,
    NgFor,
    AsyncPipe,
    NgClass, // <--- Ensure NgClass is here
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule, // MatListModule might not be strictly needed if only mat-card is used
    MessageBox, // Import MessageBox and MatSnackBar for notifications
  ],
})
export class AdminPanel implements OnInit, OnDestroy {
  allUsers: AdminUserDisplay[] = [];
  isLoading: boolean = true;
  message: string = '';
  showMessageBox: boolean = false;

  private usersSubscription: Subscription | undefined;
  private isAdminSubscription: Subscription | undefined;
  isAdmin: boolean = false;

  constructor(
    private firebaseService: Firebase,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.isAdminSubscription = this.firebaseService.isAdmin$.subscribe(
      (isAdmin) => {
        this.isAdmin = isAdmin;
        if (isAdmin) {
          this.loadAllUsers();
        } else {
          this.message =
            'Access Denied. You do not have administrative privileges.';
          this.showMessageBox = true;
          this.isLoading = false;
          this.allUsers = [];
        }
      }
    );
  }

  ngOnDestroy(): void {
    this.usersSubscription?.unsubscribe();
    this.isAdminSubscription?.unsubscribe();
  }

  loadAllUsers(): void {
    this.isLoading = true;
    this.message = '';
    this.showMessageBox = false;

    this.usersSubscription = this.firebaseService
      .getAllUserProfiles()
      .subscribe({
        next: (users: UserProfile[]) => {
          // Type users array as UserProfile[]
          this.allUsers = users.map(
            (user) =>
              ({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                profilePictureUrl: user.profilePictureUrl,
                role: user.role || 'user', // Provide a default if role is undefined
              } as AdminUserDisplay)
          );
          this.isLoading = false;
          console.log('Admin Panel: All users loaded:', this.allUsers);
        },
        error: (err) => {
          console.error('Admin Panel: Error loading users:', err);
          this.message = `Error loading users: ${err.message}`;
          this.showMessageBox = true;
          this.isLoading = false;
        },
      });
  }
  /**
   * Placeholder for deleting another user.
   * In a real app, this would trigger a Firebase Cloud Function.
   * This method is client-side only and will just show a message.
   */

  deleteUserAsAdmin(uid: string, email: string): void {
    const confirmationMessage = `Are you sure you want to delete user ${email} (UID: ${uid})? This action cannot be undone.`;
    const snackBarRef = this.snackBar.open(
      confirmationMessage,
      'Confirm Delete',
      {
        duration: 10000, // Longer duration for critical action
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['snackbar-warn'], // Custom class for warning style
      }
    );

    snackBarRef.onAction().subscribe(() => {
      console.warn(
        `Admin action: Attempting to delete user ${uid}. This requires a Firebase Cloud Function for actual Auth deletion!`
      );
      this.snackBar.open(
        `Deletion request for ${email} sent (requires Cloud Function).`,
        'Dismiss',
        {
          duration: 5000,
          panelClass: ['snackbar-info'],
        }
      );
      // Example of how you would call a Cloud Function (pseudo-code):
      // import { getFunctions, httpsCallable } from '@angular/fire/functions';
      // const functions = getFunctions();
      // const deleteUserFn = httpsCallable(functions, 'deleteUserByAdmin');
      // deleteUserFn({ uid: uid }).then(() => {
      //   this.snackBar.open(`User ${email} deleted successfully!`, 'Dismiss', { duration: 3000, panelClass: ['snackbar-success'] });
      // }).catch(error => {
      //   this.snackBar.open(`Failed to delete user: ${error.message}`, 'Dismiss', { duration: 5000, panelClass: ['snackbar-error'] });
      // });
    });
  }

  /**
   * Changes a user's role in Firestore.
   * Admin must have write access to other user profiles in Firestore (enforced by rules).
   */
  changeUserRole(uid: string, newRole: 'user' | 'admin'): void {
    const confirmationMessage = `Are you sure you want to change role of ${
      this.allUsers.find((u) => u.uid === uid)?.displayName || uid
    } to ${newRole}?`;
    const snackBarRef = this.snackBar.open(confirmationMessage, 'Confirm', {
      duration: 7000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['snackbar-info'],
    });

    snackBarRef.onAction().subscribe(() => {
      this.message = '';
      this.showMessageBox = false;
      this.firebaseService.updateUserProfile(uid, { role: newRole }).subscribe({
        next: () => {
          this.snackBar.open(
            `User ${uid} role changed to ${newRole}.`,
            'Dismiss',
            {
              duration: 3000,
              panelClass: ['snackbar-success'],
            }
          );
          // UI will update automatically via onSnapshot listener in loadAllUsers
        },
        error: (err) => {
          console.error('Admin Panel: Change role failed:', err);
          this.snackBar.open(
            `Failed to change role: ${err.message}`,
            'Dismiss',
            {
              duration: 5000,
              panelClass: ['snackbar-error'],
            }
          );
        },
      });
    });
  }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }
  // NEW: trackBy function for *ngFor
  trackByUid(index: number, user: AdminUserDisplay): string {
    return user.uid;
  }
}
