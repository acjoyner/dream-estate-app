import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firebase } from '../services/firebase'; // Real Firebase service
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgIf, NgFor, DatePipe, NgClass } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-media-display',
  templateUrl: './media-display.html',
  styleUrls: ['./media-display.scss'],
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, NgIf, NgFor, DatePipe, NgClass, MessageBox]
})
export class MediaDisplay implements OnInit, OnDestroy {
  mediaItems: any[] = [];
  messageBox: string | null = null;
  currentUserId: string | null = null;
  isAdmin: boolean = false; // New: To check if current user is admin

  private mediaSubscription: Subscription | undefined;
  private userIdSubscription: Subscription | undefined;
  private isAdminSubscription: Subscription | undefined; // New subscription for admin status

  constructor(private firebaseService: Firebase, private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.userIdSubscription = this.firebaseService.userId$.subscribe(userId => {
      this.currentUserId = userId;
      if (userId) {
        if (this.mediaSubscription) {
            this.mediaSubscription.unsubscribe();
        }
        this.mediaSubscription = this.firebaseService.getMediaItems().subscribe({
            next: (items) => {
                this.mediaItems = items;
                console.log('Real Firebase: Media items updated:', this.mediaItems);
            },
            error: (error) => {
                console.error("Real Firebase: Error fetching media items:", error);
                this.messageBox = "Error fetching media. Check console and Firebase rules!";
            }
        });
      } else {
        this.mediaItems = [];
        if (this.mediaSubscription) {
            this.mediaSubscription.unsubscribe();
        }
      }
    });

    // New: Subscribe to admin status
    this.isAdminSubscription = this.firebaseService.isAdmin$.subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });
  }

  ngOnDestroy(): void {
    this.mediaSubscription?.unsubscribe();
    this.userIdSubscription?.unsubscribe();
    this.isAdminSubscription?.unsubscribe(); // New: Unsubscribe admin status
  }

  likeMedia(mediaItem: any): void {
    if (!this.currentUserId) {
        this.messageBox = 'Please log in to like items.';
        return;
    }
    this.firebaseService.likeMedia(mediaItem.id, this.currentUserId).subscribe({
      next: () => {
        console.log(`Real Firebase: Liked/unliked media: ${mediaItem.id}`);
      },
      error: (error) => {
        console.error('Real Firebase: Like/unlike failed:', error);
        this.messageBox = `Error: ${error.message}`;
      }
    });
  }

  // MODIFIED: onDeleteMedia to use MatSnackBar
  onDeleteMedia(mediaItem: any): void {
    if (!this.currentUserId) {
        this.messageBox = 'You must be logged in to delete media.';
        return;
    }

    const snackBarRef = this.snackBar.open(`Are you sure you want to delete "${mediaItem.fileName}"?`, 'Yes, Delete', {
      duration: 7000, // Duration before it auto-closes
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['snackbar-confirm'] // Optional custom class for styling
    });

    snackBarRef.onAction().subscribe(async () => {
      // User clicked 'Yes, Delete'
      this.messageBox = null; // Clear previous messages
      try {
        await this.firebaseService.deleteMedia(mediaItem.id, mediaItem.ownerId, mediaItem.fileName).toPromise();
        this.snackBar.open(`"${mediaItem.fileName}" deleted successfully!`, 'Dismiss', {
          duration: 3000, panelClass: ['snackbar-success']
        });
      } catch (error: any) {
        console.error('Real Firebase: Media deletion failed:', error);
        this.snackBar.open(`Failed to delete media: ${error.message}`, 'Dismiss', {
          duration: 5000, panelClass: ['snackbar-error']
        });
      }
    });
    // If the snackbar closes without action (duration expires or user clicks elsewhere),
    // we don't do anything, as it implies they didn't confirm.
  }

  userHasLiked(mediaItem: any): boolean {
    return mediaItem.likes && mediaItem.likes.includes(this.currentUserId);
  }

  closeMessageBox(): void {
    this.messageBox = null;
  }
}