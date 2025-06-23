import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { Firebase, ChatInitiationData } from './services/firebase';
import { Subscription } from 'rxjs';
import { NgIf, AsyncPipe } from '@angular/common';
import { filter } from 'rxjs/operators'; // Ensure filter is imported

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ChatWindow } from './chat-window/chat-window'; // Ensure ChatWindow is imported

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, NgIf, AsyncPipe,
    MatToolbarModule, MatButtonModule, MatIconModule,
    ChatWindow
  ]
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

  constructor(public firebaseService: Firebase, private router: Router) {}

  ngOnInit(): void {
    this.userIdSubscription = this.firebaseService.userId$.subscribe(userId => {
      this.currentUserId = userId;
      console.log('App: currentUserId updated:', this.currentUserId);
    });
    this.isReadySubscription = this.firebaseService.isReady$.subscribe(isReady => {
      this.isServiceReady = isReady;
      console.log('App: isServiceReady updated:', this.isServiceReady);
    });
    this.profilePictureSubscription = this.firebaseService.currentUserProfilePictureUrl$.subscribe(url => {
      this.userProfilePictureUrl = url;
    });
    this.isAdminSubscription = this.firebaseService.isAdmin$.subscribe(isAdmin => {
      this.isAdmin = isAdmin;
      console.log('App: isAdmin updated:', this.isAdmin);
    });

    this.routerEventsSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.handleCloseChat();
    });

    // CRITICAL: Ensure subscription correctly receives and processes chatData
    this.openChatWindowSubscription = this.firebaseService.openChatWindow$.subscribe(chatData => {
      console.log('App: openChatWindow$ emitted:', chatData); // DIAGNOSTIC LOG: See raw emission
      if (chatData === null) {
        console.log('App: openChatWindow$ emitted null. Not opening chat.');
        return; // Exit if initial or reset null emission
      }

      console.log('App: Received non-null chatData from service:', chatData); // DIAGNOSTIC LOG: Non-null data
      if (this.currentUserId) { // Ensure user is logged in before proceeding
        console.log('App: Current user is logged in. Proceeding to get/create chat room.'); // DIAGNOSTIC LOG
        this.firebaseService.getOrCreateChatRoom(this.currentUserId, chatData.otherUserUid).subscribe({
          next: (chatRoomId) => {
            this.selectedChatRoomId = chatRoomId;
            this.selectedChatParticipantUid = chatData.otherUserUid;
            this.selectedChatParticipantName = chatData.otherUserName;
            this.selectedChatParticipantPic = chatData.otherUserPic;
            this.showChatWindow = true; // Show the modal chat window
            console.log('App: Successfully prepared chat window. showChatWindow:', this.showChatWindow);
          },
          error: (error) => {
            console.error('App: Error getting/creating chat room:', error);
            // Optionally display a message to the user
          }
        });
      } else {
        console.warn('App: Attempted to open chat but no user is logged in when chatData received. Chat not opened.');
        // Optionally redirect to login or show a message
      }
    });
  }

  ngOnDestroy(): void {
    this.userIdSubscription?.unsubscribe();
    this.isReadySubscription?.unsubscribe();
    this.profilePictureSubscription?.unsubscribe();
    this.isAdminSubscription?.unsubscribe();
    this.routerEventsSubscription?.unsubscribe();
    this.openChatWindowSubscription?.unsubscribe();
  }

  async onLogout(): Promise<void> {
    await this.firebaseService.logout().toPromise();
    this.showChatWindow = false;
    this.router.navigate(['/login']);
  }

  handleSelectChat(chatData: {otherUserUid: string, otherUserName: string, otherUserPic?: string}): void {
    // This method is now OBSOLETE as Friends directly calls FirebaseService.triggerOpenChatWindow
    // It should NOT be called. If any part of your code is still calling it, remove that call.
  }

  handleCloseChat(): void {
    this.showChatWindow = false;
    this.selectedChatRoomId = null;
    this.selectedChatParticipantUid = null;
    this.selectedChatParticipantName = '';
    this.selectedChatParticipantPic = undefined;
  }
}