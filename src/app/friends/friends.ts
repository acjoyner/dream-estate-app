import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { Firebase, ChatInitiationData, OnlineStatus, UserProfile } from '../services/firebase';
import { Subscription, combineLatest, firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { NgIf, NgFor, AsyncPipe, NgClass } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box';
import { filter, map } from 'rxjs/operators';

// UserProfileForFriends interface should perfectly mirror the required subset of UserProfile
interface UserProfileForFriends {
  uid: string;
  email: string;
  displayName: string;
  profilePictureUrl?: string;
  isPrivate: boolean;
  friends: string[];
  sentRequests: string[];
  receivedRequests: string[];
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
            next: (profile: UserProfile | null) => { // Type profile as UserProfile
              if (profile) {
                  this.currentUserProfile = {
                      uid: profile.uid, // No ? or || '' needed if UserProfile guarantees string
                      displayName: profile.displayName,
                      email: profile.email,
                      profilePictureUrl: profile.profilePictureUrl,
                      isPrivate: profile.isPrivate,
                      friends: profile.friends,
                      sentRequests: profile.sentRequests,
                      receivedRequests: profile.receivedRequests
                  } as UserProfileForFriends; // Explicit cast after dot notation access
              } else {
                  this.currentUserProfile = null;
              }
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
        map((users: UserProfile[]) => users.filter((user: UserProfile) => user.uid !== this.currentUserId) // FIX: Explicitly type user as UserProfile
          .map((user: UserProfile) => ({ // FIX: Explicitly type user as UserProfile here as well
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            profilePictureUrl: user.profilePictureUrl,
            isPrivate: user.isPrivate,
            friends: user.friends,
            sentRequests: user.sentRequests,
            receivedRequests: user.receivedRequests
          } as UserProfileForFriends)) // Explicit cast after mapping
        )
      ).subscribe({
        next: (users) => {
          this.allUsers = users;
          console.log("FriendsComponent: allUsers loaded:", this.allUsers);
          this.allUsers.forEach(user => {
            if (!this.onlineStatusSubscriptions[user.uid]) {
              this.onlineStatusSubscriptions[user.uid] = this.firebaseService.getOnlineStatus(user.uid).subscribe(status => {
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

  getOnlineStatusText(uid: string): string {
    const status = this.onlineStatusMap[uid]?.state;
    switch (status) {
      case 'online': return 'Online';
      case 'away': return 'Away';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  }

  async sendRequest(receiverUid: string): Promise<void> {
    console.log('FriendsComponent: sendRequest called for:', receiverUid);
    if (!this.currentUserId) { console.warn('FriendsComponent: Cannot send request, currentUserId is null.'); return; }
    this.message = ''; this.messageType = ''; this.showMessageBox = false;
    try {
      await firstValueFrom(this.firebaseService.sendFriendRequest(this.currentUserId, receiverUid));
      this.message = 'Friend request sent!'; this.messageType = 'success'; console.log(`Request sent to ${receiverUid}`);
    } catch (error: any) { this.message = `Failed to send request: ${error.message}`; this.messageType = 'error'; this.showMessageBox = true; console.error('Send request failed:', error); }
  }

  async acceptRequest(senderUid: string): Promise<void> {
    console.log('FriendsComponent: acceptRequest called for:', senderUid);
    if (!this.currentUserId) { console.warn('FriendsComponent: Cannot accept request, currentUserId is null.'); return; }
    this.message = ''; this.messageType = ''; this.showMessageBox = false;
    try {
      await firstValueFrom(this.firebaseService.acceptFriendRequest(this.currentUserId, senderUid));
      this.message = 'Friend request accepted!'; this.messageType = 'success'; console.log(`Request from ${senderUid} accepted`);
    } catch (error: any) { this.message = `Failed to accept request: ${error.message}`; this.messageType = 'error'; this.showMessageBox = true; console.error('Accept request failed:', error); }
  }

  async rejectRequest(senderUid: string): Promise<void> {
    console.log('FriendsComponent: rejectRequest called for:', senderUid);
    if (!this.currentUserId) { console.warn('FriendsComponent: Cannot reject request, currentUserId is null.'); return; }
    this.message = ''; this.messageType = ''; this.showMessageBox = false;
    try {
      await firstValueFrom(this.firebaseService.rejectFriendRequest(this.currentUserId, senderUid));
      this.message = 'Friend request rejected.'; this.messageType = 'success'; console.log(`Request from ${senderUid} rejected`);
    } catch (error: any) { this.message = `Failed to reject request: ${error.message}`; this.messageType = 'error'; this.showMessageBox = true; console.error('Reject request failed:', error); }
  }

  async removeFriend(friendUid: string): Promise<void> {
    console.log('FriendsComponent: removeFriend called for:', friendUid);
    if (!this.currentUserId) { console.warn('FriendsComponent: Cannot remove friend, currentUserId is null.'); return; }
    this.message = ''; this.messageType = ''; this.showMessageBox = false;
    try {
      await firstValueFrom(this.firebaseService.removeFriend(this.currentUserId, friendUid));
      this.message = 'Friend removed.'; this.messageType = 'success'; console.log(`Friend ${friendUid} removed`);
    } catch (error: any) { this.message = `Failed to remove friend: ${error.message}`; this.messageType = 'error'; this.showMessageBox = true; console.error('Remove friend failed:', error); }
  }

  onSelectChat(user: UserProfileForFriends): void {
    console.log('Friends: Message button clicked for user:', user.displayName, user.uid);
    const chatData: ChatInitiationData = {
      otherUserUid: user.uid,
      otherUserName: user.displayName,
      otherUserPic: user.profilePictureUrl
    };
    this.firebaseService.triggerOpenChatWindow(chatData);
  }

  isFriend(user: UserProfileForFriends): boolean { return !!this.currentUserProfile?.friends?.includes(user.uid); }
  isSentRequest(user: UserProfileForFriends): boolean { return !!this.currentUserProfile?.sentRequests?.includes(user.uid); }
  isReceivedRequest(user: UserProfileForFriends): boolean { return !!this.currentUserProfile?.receivedRequests?.includes(user.uid); }
  get pendingSentRequests(): UserProfileForFriends[] { return this.allUsers.filter(user => !!(this.currentUserProfile?.sentRequests?.includes(user.uid))); }
  get pendingReceivedRequests(): UserProfileForFriends[] { return this.allUsers.filter(user => !!(this.currentUserProfile?.receivedRequests?.includes(user.uid))); }
  get friendsList(): UserProfileForFriends[] { return this.allUsers.filter(user => !!(this.currentUserProfile?.friends?.includes(user.uid))); }
  get otherUsers(): UserProfileForFriends[] {
    if (!this.currentUserId) return [];
    return this.allUsers.filter(user => !this.isFriend(user) && !this.isSentRequest(user) && !this.isReceivedRequest(user) && user.uid !== this.currentUserId);
  }
  closeMessageBox(): void { this.showMessageBox = false; }
}