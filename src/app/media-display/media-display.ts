import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList, AfterViewInit } from '@angular/core';
import { Firebase } from '../services/firebase';
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgIf, NgFor, DatePipe, NgClass } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box';
import { MatSnackBar } from '@angular/material/snack-bar';

interface UserProfileForDisplay {
    uid: string;
    email: string;
    displayName: string;
    profilePictureUrl?: string;
    isPrivate: boolean;
    role: 'user' | 'admin';
    friends: string[];
    sentRequests: string[];
    receivedRequests: string[];
}

@Component({
  selector: 'app-media-display',
  templateUrl: './media-display.html',
  styleUrls: ['./media-display.scss'],
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, NgIf, NgFor, DatePipe, NgClass, MessageBox]
})
export class MediaDisplay implements OnInit, OnDestroy, AfterViewInit {
  mediaItems: any[] = [];
  messageBox: string | null = null;
  currentUserId: string | null = null;
  isAdmin: boolean = false;

  allUsersMap: { [uid: string]: UserProfileForDisplay } = {};

  isPlayingMap: { [mediaId: string]: boolean } = {};
  isInteractingWithControls: boolean = false; // New: Flag to indicate user is interacting with controls area

  @ViewChildren('videoPlayer') videoPlayers!: QueryList<ElementRef<HTMLVideoElement>>;

  private mediaSubscription: Subscription | undefined;
  private userIdSubscription: Subscription | undefined;
  private isAdminSubscription: Subscription | undefined;
  private allUsersSubscription: Subscription | undefined;
  private intersectionObserver: IntersectionObserver | undefined;

  constructor(private firebaseService: Firebase, private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.userIdSubscription = this.firebaseService.userId$.subscribe(userId => {
      this.currentUserId = userId;
      console.log('MediaDisplay: currentUserId updated:', this.currentUserId);
      if (userId) {
        if (this.mediaSubscription) {
            this.mediaSubscription.unsubscribe();
        }
        this.mediaSubscription = this.firebaseService.getMediaItems().subscribe({
            next: (items) => {
                this.mediaItems = items;
                console.log('Real Firebase: Media items updated:', this.mediaItems);
                setTimeout(() => this.setupIntersectionObserver(), 0);
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
        this.destroyIntersectionObserver();
      }
    });

    this.isAdminSubscription = this.firebaseService.isAdmin$.subscribe(isAdmin => {
      this.isAdmin = isAdmin;
      console.log('MediaDisplay: isAdmin updated:', this.isAdmin);
    });

    this.allUsersSubscription = this.firebaseService.getAllUserProfiles().subscribe({
      next: (users) => {
        this.allUsersMap = users.reduce((acc, user) => {
          acc[user.uid] = user as UserProfileForDisplay;
          return acc;
        }, {} as { [uid: string]: UserProfileForDisplay });
        console.log('Real Firebase: All users map updated for display names.');
      },
      error: (error) => {
        console.error("Real Firebase: Error fetching all user profiles for display names:", error);
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
        this.setupIntersectionObserver();
    }, 100);
  }

  ngOnDestroy(): void {
    this.mediaSubscription?.unsubscribe();
    this.userIdSubscription?.unsubscribe();
    this.isAdminSubscription?.unsubscribe();
    this.allUsersSubscription?.unsubscribe();
    this.destroyIntersectionObserver();
  }

  private setupIntersectionObserver(): void {
    this.destroyIntersectionObserver();

    if (this.videoPlayers && this.videoPlayers.length > 0) {
        this.intersectionObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const video = entry.target as HTMLVideoElement;
                const mediaItemId = video.dataset['mediaItemId'];

                if (video && mediaItemId) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.9 && this.currentUserId) {
                        video.play().then(() => {
                            this.isPlayingMap[mediaItemId] = true;
                        }).catch(e => {
                            console.warn('Video play prevented by browser:', e);
                            this.isPlayingMap[mediaItemId] = false;
                        });
                    } else {
                        video.pause();
                        this.isPlayingMap[mediaItemId] = false;
                    }
                }
            });
        }, {
            threshold: 0.9
        });

        this.videoPlayers.forEach(videoRef => {
            this.intersectionObserver!.observe(videoRef.nativeElement);
        });
        console.log('IntersectionObserver set up for videos.');
    } else {
        console.log('No video players found for IntersectionObserver setup yet or media not loaded.');
    }
  }

  private destroyIntersectionObserver(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
      console.log('IntersectionObserver destroyed.');
    }
  }

  getUserDisplayName(uid: string): string {
    return this.allUsersMap[uid]?.displayName || `User_${uid.substring(0, 6)}`;
  }

  // FIX: Implemented startInteraction and endInteraction methods
  startInteraction(event: Event): void {
    event.stopPropagation(); // Stop click from propagating to the main media wrapper
    this.isInteractingWithControls = true;
    // console.log('Start Interaction (Controls Area)'); // Diagnostic
  }

  endInteraction(): void {
    this.isInteractingWithControls = false;
    // console.log('End Interaction (Controls Area)'); // Diagnostic
  }

  // Method now accepts optional event parameter
  toggleVideoPlayPause(mediaItemId: string, event?: Event): void {
    if (event) {
        event.stopPropagation(); // Prevent scroll snapping from triggering if clicking directly on video
    }

    const videoRef = this.videoPlayers.find(ref => ref.nativeElement.dataset['mediaItemId'] === mediaItemId);
    if (videoRef) {
      const videoElement = videoRef.nativeElement;
      if (videoElement.paused) {
        videoElement.play().then(() => {
          this.isPlayingMap[mediaItemId] = true;
        }).catch(e => console.warn('Manual video play prevented:', e));
      } else {
        videoElement.pause();
        this.isPlayingMap[mediaItemId] = false;
      }
    } else {
        console.warn(`Video element not found for mediaItemId: ${mediaItemId}`);
    }
  }

  // Method now accepts optional event parameter
  likeMedia(mediaItem: any, event?: Event): void {
    if (event) event.stopPropagation(); // Prevent scroll snapping
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

  // Method now accepts optional event parameter
  onDeleteMedia(mediaItem: any, event?: Event): void {
    if (event) event.stopPropagation(); // Prevent scroll snapping
    if (!this.currentUserId) {
        this.snackBar.open('You must be logged in to delete media.', 'Dismiss', { duration: 3000, panelClass: ['snackbar-error'] });
        return;
    }

    const snackBarRef = this.snackBar.open(`Are you sure you want to delete "${mediaItem.fileName}"?`, 'Yes, Delete', {
      duration: 7000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['snackbar-confirm']
    });

    snackBarRef.onAction().subscribe(async () => {
      this.messageBox = null;
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
  }

  userHasLiked(mediaItem: any): boolean {
    return mediaItem.likes && mediaItem.likes.includes(this.currentUserId);
  }

  closeMessageBox(): void {
    this.messageBox = null;
  }

  trackByMediaItem(index: number, item: any): string {
    return item.id;
  }
}