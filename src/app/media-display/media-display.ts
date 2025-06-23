import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firebase } from '../services/firebase'; // Real Firebase service
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgIf, NgFor, DatePipe, NgClass } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box';

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
  currentUserId: string | null = null; // Real user ID

  private mediaSubscription: Subscription | undefined;
  private userIdSubscription: Subscription | undefined;

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void {
    this.userIdSubscription = this.firebaseService.userId$.subscribe(userId => {
      this.currentUserId = userId;
      if (userId) { // Only subscribe to media if authenticated
        if (this.mediaSubscription) {
            this.mediaSubscription.unsubscribe();
        }
        // Use real Firebase getMediaItems
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
        this.mediaItems = []; // Clear items if logged out
        if (this.mediaSubscription) {
            this.mediaSubscription.unsubscribe();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.mediaSubscription?.unsubscribe();
    this.userIdSubscription?.unsubscribe();
  }

  likeMedia(mediaItem: any): void {
    if (!this.currentUserId) {
        this.messageBox = 'Please log in to like items.';
        return;
    }
    // Use real Firebase likeMedia
    this.firebaseService.likeMedia(mediaItem.id, this.currentUserId).subscribe({
      next: () => {
        console.log(`Real Firebase: Liked/unliked media: ${mediaItem.id}`);
        // UI updates automatically via onSnapshot listener in FirebaseService
      },
      error: (error: { message: any; }) => {
        console.error('Real Firebase: Like/unlike failed:', error);
        this.messageBox = `Error: ${error.message}`;
      }
    });
  }

  userHasLiked(mediaItem: any): boolean {
    return mediaItem.likes && mediaItem.likes.includes(this.currentUserId);
  }

  closeMessageBox(): void {
    this.messageBox = null;
  }
}