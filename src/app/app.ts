import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from '@angular/router';
import {
  Firebase,
  ChatInitiationData,
  NewMessageNotification,
} from './services/firebase';
import { Subscription } from 'rxjs';
import { NgIf, AsyncPipe } from '@angular/common';
import { filter, tap } from 'rxjs/operators'; // Added tap for logging

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ChatWindow } from './chat-window/chat-window';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgIf,
    AsyncPipe,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    ChatWindow,
  ],
})
export class App implements OnInit, OnDestroy {
  title = 'DreamEstate';
  currentUserId: string | null = null;
  isServiceReady: boolean = false;
  userProfilePictureUrl: string | null = null;
  isAdmin: boolean = false;

  showChatWindow: boolean = false;
  selectedChatRoomId: string | null = null;
  selectedChatParticipantUid: string | null = null;
  selectedChatParticipantName: string = '';
  selectedChatParticipantPic: string | undefined = undefined;

  private userIdSubscription: Subscription | undefined;
  private isReadySubscription: Subscription | undefined;
  private profilePictureSubscription: Subscription | undefined;
  private isAdminSubscription: Subscription | undefined;
  private routerEventsSubscription: Subscription | undefined;
  private openChatWindowSubscription: Subscription | undefined;
  private newMessageNotificationSubscription: Subscription | undefined;

  constructor(
    public firebaseService: Firebase,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // FIX: Combine subscriptions for user state and readiness for clearer logic
    this.userIdSubscription = this.firebaseService.userId$
      .pipe(tap((userId) => console.log('App: userId$ emitted:', userId)))
      .subscribe((userId) => {
        this.currentUserId = userId;
        console.log('App: currentUserId updated:', this.currentUserId);
        // FIX: Navigate based on login status when userId changes
        // If user logs in and is on login/signup/home, redirect to display
        if (
          userId &&
          (this.router.url === '/login' ||
            this.router.url === '/signup' ||
            this.router.url === '/home' ||
            this.router.url === '/')
        ) {
          this.router.navigate(['/display']);
        }
        // If user logs out and is on a protected page, redirect to login
        else if (
          !userId &&
          this.router.url !== '/login' &&
          this.router.url !== '/signup' &&
          this.router.url !== '/home' &&
          this.router.url !== '/resources'
        ) {
          this.router.navigate(['/login']);
        }
      });
    this.isReadySubscription = this.firebaseService.isReady$.subscribe(
      (isReady) => {
        this.isServiceReady = isReady;
        console.log('App: isServiceReady updated:', this.isServiceReady);
      }
    );

    this.profilePictureSubscription =
      this.firebaseService.currentUserProfilePictureUrl$.subscribe((url) => {
        this.userProfilePictureUrl = url;
      });

    this.isAdminSubscription = this.firebaseService.isAdmin$.subscribe(
      (isAdmin) => {
        this.isAdmin = isAdmin;
        console.log('App: isAdmin updated:', this.isAdmin);
      }
    );

    this.routerEventsSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.handleCloseChat();
      });

    this.openChatWindowSubscription =
      this.firebaseService.openChatWindow$.subscribe((chatData) => {
        console.log('App: openChatWindow$ emitted:', chatData);
        if (chatData === null) {
          console.log('App: openChatWindow$ emitted null. Not opening chat.');
          return;
        }

        console.log('App: Received non-null chatData from service:', chatData);
        if (this.currentUserId) {
          console.log(
            'App: Current user is logged in. Proceeding to get/create chat room.'
          );
          this.firebaseService
            .getOrCreateChatRoom(this.currentUserId, chatData.otherUserUid)
            .subscribe({
              next: (chatRoomId) => {
                this.selectedChatRoomId = chatRoomId;
                this.selectedChatParticipantUid = chatData.otherUserUid;
                this.selectedChatParticipantName = chatData.otherUserName;
                this.selectedChatParticipantPic = chatData.otherUserPic;
                this.showChatWindow = true;
                this.firebaseService.setCurrentlyOpenChatRoom(chatRoomId);
                console.log(
                  'App: Successfully prepared chat window. showChatWindow:',
                  this.showChatWindow
                );
              },
              error: (error) => {
                console.error('App: Error getting/creating chat room:', error);
              },
            });
        } else {
          console.warn(
            'App: Attempted to open chat but no user is logged in when chatData received. Chat not opened.'
          );
        }
      });

    this.newMessageNotificationSubscription =
      this.firebaseService.newMessageNotification$.subscribe((notification) => {
        if (
          !this.showChatWindow ||
          this.selectedChatRoomId !== notification.chatRoomId
        ) {
          const message = `${notification.senderName}: ${notification.messageText}`;
          this.snackBar
            .open(message, 'View', {
              duration: 5000,
              horizontalPosition: 'end',
              verticalPosition: 'top',
              panelClass: ['snackbar-notification'],
            })
            .onAction()
            .subscribe(() => {
              this.router.navigate(['/friends']).then(() => {
                this.firebaseService.triggerOpenChatWindow({
                  otherUserUid: notification.senderUid,
                  otherUserName: notification.senderName,
                  otherUserPic: (
                    this.firebaseService.getAllUserProfiles() as any
                  )._value.find((u: any) => u.uid === notification.senderUid)
                    ?.profilePictureUrl, // HACK for mock
                });
              });
            });
        }
      });
  }

  ngOnDestroy(): void {
    this.userIdSubscription?.unsubscribe();
    this.isReadySubscription?.unsubscribe();
    this.profilePictureSubscription?.unsubscribe();
    this.routerEventsSubscription?.unsubscribe();
    this.openChatWindowSubscription?.unsubscribe();
    this.newMessageNotificationSubscription?.unsubscribe();
    // Unsubscribe from isAdmin to prevent memory leaks
    this.isAdminSubscription?.unsubscribe();
    console.log('App: Unsubscribed from all subscriptions.');
    this.firebaseService.setCurrentlyOpenChatRoom(null); // Reset chat room on destroy
    this.showChatWindow = false; // Ensure chat window is closed on destroy
    this.selectedChatRoomId = null; // Reset selected chat room
  }

  async onLogout(): Promise<void> {
    await this.firebaseService.logout().toPromise();
    this.showChatWindow = false;
    this.router.navigate(['/login']);
  }

  handleSelectChat(chatData: {
    otherUserUid: string;
    otherUserName: string;
    otherUserPic?: string;
  }): void {
    /* ... */
  }
  handleCloseChat(): void {
    this.showChatWindow = false;
    this.selectedChatRoomId = null;
    this.selectedChatParticipantUid = null;
    this.selectedChatParticipantName = '';
    this.selectedChatParticipantPic = undefined;
    this.firebaseService.setCurrentlyOpenChatRoom(null); // Inform service chat is closed
  }
}
