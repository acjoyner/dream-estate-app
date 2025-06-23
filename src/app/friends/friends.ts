import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { Firebase, ChatInitiationData, OnlineStatus } from '../services/firebase'; // Ensure OnlineStatus is imported
import { Subscription, combineLatest, firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { NgIf, NgFor, AsyncPipe, NgClass } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box';
import { filter, map } from 'rxjs/operators';

// FIX: UserProfileForFriends now mirrors the Firebase service's UserProfile,
// ensuring type compatibility when mapping.
interface UserProfileForFriends {
  uid: string;
  email: string;
  displayName: string;
  profilePictureUrl?: string;
  isPrivate: boolean;
  friends: string[];
  sentRequests: string[];
  receivedRequests: string[];
  // Role, chatRooms, lastOnline are part of UserProfile from Firebase service
  // You can include them here if Friends component needs them, but avoid if not for simplicity.
}

@Component({
  selector: 'app-friends',
  templateUrl: './friends.html',
  styleUrls: ['./friends.scss'],
  standalone: true,
  imports: [
    NgIf, NgFor, AsyncPipe, NgClass,
    MatCardModule, MatButtonModule, MatIconModule, MatListModule,
    MessageBox
  ]
})
export class Friends implements OnInit, OnDestroy {
  @Output() selectChat = new EventEmitter<{otherUserUid: string, otherUserName: string, otherUserPic?: string}>();

  allUsers: UserProfileForFriends[] = [];
  currentUserProfile: UserProfileForFriends | null = null;
  currentUserId: string | null = null;
  isLoading: boolean = true;
  message: string = '';
  messageType: string = '';
  showMessageBox: boolean = false;

  onlineStatusMap: { [uid: string]: OnlineStatus } = {}; // Map to store online statuses

  private subscriptions: Subscription[] = [];
  private onlineStatusSubscriptions: { [uid: string]: Subscription } = {}; // To manage individual status subscriptions

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void {
    console.log('FriendsComponent: ngOnInit called.');
    this.subscriptions.push(
      this.firebaseService.userId$.pipe(filter(uid => !!uid)).subscribe(uid => {
        this.currentUserId = uid;
        console.log('FriendsComponent: currentUserId received:', this.currentUserId);
        this.isLoading = true;
        this.subscriptions.push(
          this.firebaseService.getUserProfile(uid!).subscribe({
            next: (profile) => {
              this.currentUserProfile = {
                uid: profile?.['uid'] || '',
                displayName: profile?.['displayName'] || '',
                email: profile?.['email'] || '',
                profilePictureUrl: profile?.['profilePictureUrl'],
                isPrivate: profile?.['isPrivate'] || false,
                friends: profile?.['friends'] || [],
                sentRequests: profile?.['sentRequests'] || [],
                receivedRequests: profile?.['receivedRequests'] || []
              } as UserProfileForFriends;
              this.isLoading = false;
              console.log('FriendsComponent: currentUserProfile loaded:', this.currentUserProfile);
              this.loadAllUsers();
            },
            error: (err) => {
              console.error("FriendsComponent: Error loading current user profile:", err);
              this.message = `Error loading your profile: ${err.message}`;
              this.messageType = 'error';
              this.showMessageBox = true;
              this.isLoading = false;
            }
          })
        );
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    for (const uid in this.onlineStatusSubscriptions) {
      if (this.onlineStatusSubscriptions.hasOwnProperty(uid)) {
        this.onlineStatusSubscriptions[uid].unsubscribe();
      }
    }
  }

  loadAllUsers(): void {
    console.log('FriendsComponent: loadAllUsers called.');
    this.subscriptions.push(
      this.firebaseService.getAllUserProfiles().pipe(
        map(users => users.filter(user => user['uid'] !== this.currentUserId) // user is now directly UserProfile
          .map(user => ({ // User is already UserProfile from service, convert to UserProfileForFriends
            uid: user['uid'],
            displayName: user['displayName'],
            email: user['email'],
            profilePictureUrl: user['profilePictureUrl'],
            isPrivate: user['isPrivate'],
            friends: user['friends'],
            sentRequests: user['sentRequests'],
            receivedRequests: user['receivedRequests']
          } as UserProfileForFriends)) // Explicit cast after mapping
        )
      ).subscribe({
        next: (users) => {
          this.allUsers = users;
          console.log("FriendsComponent: allUsers loaded:", this.allUsers);
          this.allUsers.forEach(user => {
            if (!this.onlineStatusSubscriptions[user.uid]) {
              this.onlineStatusSubscriptions[user.uid] = this.firebaseService['getOnlineStatus'](user.uid).subscribe((status: OnlineStatus) => {
                this.onlineStatusMap[user.uid] = status;
              });
            }
          });
        },
        error: (err) => {
          console.error("FriendsComponent: Error loading all users:", err);
          this.message = `Error loading users: ${err.message}`;
          this.messageType = 'error';
          this.showMessageBox = true;
        }
      })
    );
  }

  getOnlineStatusClass(uid: string): string {
    const status = this.onlineStatusMap[uid]?.state;
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  }

  async sendRequest(receiverUid: string): Promise<void> { /* ... */ }
  async acceptRequest(senderUid: string): Promise<void> { /* ... */ }
  async rejectRequest(senderUid: string): Promise<void> { /* ... */ }
  async removeFriend(friendUid: string): Promise<void> { /* ... */ }

  onSelectChat(user: UserProfileForFriends): void {
    console.log('Friends: Message button clicked for user:', user.displayName, user.uid);
    const chatData: ChatInitiationData = {
      otherUserUid: user.uid,
      otherUserName: user.displayName,
      otherUserPic: user.profilePictureUrl
    };
    this.firebaseService['triggerOpenChatWindow'](chatData);
  }

  isFriend(user: UserProfileForFriends): boolean {
    return !!this.currentUserProfile?.friends?.includes(user.uid);
  }

  isSentRequest(user: UserProfileForFriends): boolean {
    return !!this.currentUserProfile?.sentRequests?.includes(user.uid);
  }

  isReceivedRequest(user: UserProfileForFriends): boolean {
    return !!this.currentUserProfile?.receivedRequests?.includes(user.uid);
  }

  // Ensure filter callbacks explicitly return boolean and use dot notation
  get pendingSentRequests(): UserProfileForFriends[] {
    return this.allUsers.filter(user => !!(this.currentUserProfile?.sentRequests?.includes(user.uid)));
  }

  // Ensure filter callbacks explicitly return boolean and use dot notation
  get pendingReceivedRequests(): UserProfileForFriends[] {
    return this.allUsers.filter(user => !!(this.currentUserProfile?.receivedRequests?.includes(user.uid)));
  }

  // Ensure filter callbacks explicitly return boolean and use dot notation
  get friendsList(): UserProfileForFriends[] {
    return this.allUsers.filter(user => !!(this.currentUserProfile?.friends?.includes(user.uid)));
  }

  // Ensure filter callbacks explicitly return boolean and use dot notation
  get otherUsers(): UserProfileForFriends[] {
    if (!this.currentUserId) return [];
    return this.allUsers.filter(user =>
      !!(!this.isFriend(user) &&
      !this.isSentRequest(user) &&
      !this.isReceivedRequest(user) &&
      user.uid !== this.currentUserId) // FIX: user.uid (dot notation)
    );
  }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }
}