import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firebase } from '../services/firebase';
import { Subscription, combineLatest } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
// import { MatListModule } from '@angular/material/list'; // <-- REMOVE THIS if it was here
import { NgIf, NgFor, AsyncPipe } from '@angular/common'; // NgClass also comes from CommonModule
import { MessageBox } from '../shared/message-box/message-box';
import { filter, map } from 'rxjs/operators';
import { MatListModule } from '@angular/material/list';

interface UserProfileForFriends {
  uid: string;
  email: string; // Added email for display
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
    NgIf, NgFor, AsyncPipe,
    MatCardModule, MatButtonModule, MatIconModule,
    MessageBox, MatListModule
  ]
})
export class Friends implements OnInit, OnDestroy {
  allUsers: UserProfileForFriends[] = [];
  currentUserProfile: UserProfileForFriends | null = null;
  currentUserId: string | null = null;
  isLoading: boolean = true;
  message: string = '';
  messageType: string = '';
  showMessageBox: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void {
    this.subscriptions.push(
      this.firebaseService.userId$.pipe(filter(uid => !!uid)).subscribe(uid => {
        this.currentUserId = uid;
        this.isLoading = true; // Start loading when user ID is available
        this.subscriptions.push(
          this.firebaseService.getUserProfile(uid!).subscribe({
            next: (profile) => {
              // Ensure all relevant properties are mapped
              this.currentUserProfile = {
                uid: profile?.uid || '',
                displayName: profile?.displayName || '',
                email: profile?.email || '', // Ensure email is passed
                profilePictureUrl: profile?.profilePictureUrl,
                isPrivate: profile?.isPrivate || false,
                friends: profile?.friends || [],
                sentRequests: profile?.sentRequests || [],
                receivedRequests: profile?.receivedRequests || []
              } as UserProfileForFriends; // Cast to ensure all properties exist

              this.isLoading = false;
              this.loadAllUsers();
            },
            error: (err) => {
              console.error("Error loading current user profile for friends:", err);
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
  }

  loadAllUsers(): void {
    this.subscriptions.push(
      this.firebaseService.getAllUserProfiles().pipe(
        map(users => users
          .filter(user => user.uid !== this.currentUserId) // Exclude current user
          // Map to ensure UserProfileForFriends interface is fully satisfied
          .map(user => ({
            uid: user.uid,
            displayName: user.displayName,
            email: user.email, // Include email
            profilePictureUrl: user.profilePictureUrl,
            isPrivate: user.isPrivate,
            friends: user.friends,
            sentRequests: user.sentRequests,
            receivedRequests: user.receivedRequests
          } as UserProfileForFriends))
        )
      ).subscribe({
        next: (users) => {
          this.allUsers = users;
          console.log("All users loaded (excluding self):", users);
        },
        error: (err) => {
          console.error("Error loading all users:", err);
          this.message = `Error loading users: ${err.message}`;
          this.messageType = 'error';
          this.showMessageBox = true;
        }
      })
    );
  }

  // --- Friend Request Actions ---

  async sendRequest(receiverUid: string): Promise<void> {
    if (!this.currentUserId) return;
    this.message = ''; this.messageType = ''; this.showMessageBox = false;
    try {
      await this.firebaseService.sendFriendRequest(this.currentUserId, receiverUid).toPromise();
      this.message = 'Friend request sent!';
      this.messageType = 'success';
      console.log(`Request sent to ${receiverUid}`);
    } catch (error: any) {
      this.message = `Failed to send request: ${error.message}`;
      this.messageType = 'error';
      this.showMessageBox = true;
      console.error('Send request failed:', error);
    }
  }

  async acceptRequest(senderUid: string): Promise<void> {
    if (!this.currentUserId) return;
    this.message = ''; this.messageType = ''; this.showMessageBox = false;
    try {
      await this.firebaseService.acceptFriendRequest(this.currentUserId, senderUid).toPromise();
      this.message = 'Friend request accepted!';
      this.messageType = 'success';
      console.log(`Request from ${senderUid} accepted`);
    } catch (error: any) {
      this.message = `Failed to accept request: ${error.message}`;
      this.messageType = 'error';
      this.showMessageBox = true;
      console.error('Accept request failed:', error);
    }
  }

  async rejectRequest(senderUid: string): Promise<void> {
    if (!this.currentUserId) return;
    this.message = ''; this.messageType = ''; this.showMessageBox = false;
    try {
      await this.firebaseService.rejectFriendRequest(this.currentUserId, senderUid).toPromise();
      this.message = 'Friend request rejected.';
      this.messageType = 'success';
      console.log(`Request from ${senderUid} rejected`);
    } catch (error: any) {
      this.message = `Failed to reject request: ${error.message}`;
      this.messageType = 'error';
      this.showMessageBox = true;
      console.error('Reject request failed:', error);
    }
  }

  async removeFriend(friendUid: string): Promise<void> {
    if (!this.currentUserId) return;
    this.message = ''; this.messageType = ''; this.showMessageBox = false;
    try {
      await this.firebaseService.removeFriend(this.currentUserId, friendUid).toPromise();
      this.message = 'Friend removed.';
      this.messageType = 'success';
      console.log(`Friend ${friendUid} removed`);
    } catch (error: any) {
      this.message = `Failed to remove friend: ${error.message}`;
      this.messageType = 'error';
      this.showMessageBox = true;
      console.error('Remove friend failed:', error);
    }
  }

  // --- UI Helpers ---

  isFriend(user: UserProfileForFriends): boolean {
    return this.currentUserProfile?.friends?.includes(user.uid) || false;
  }

  isSentRequest(user: UserProfileForFriends): boolean {
    return this.currentUserProfile?.sentRequests?.includes(user.uid) || false;
  }

  isReceivedRequest(user: UserProfileForFriends): boolean {
    return this.currentUserProfile?.receivedRequests?.includes(user.uid) || false;
  }

  get pendingSentRequests(): UserProfileForFriends[] {
    return this.allUsers.filter(user => this.currentUserProfile?.sentRequests?.includes(user.uid));
  }

  get pendingReceivedRequests(): UserProfileForFriends[] {
    return this.allUsers.filter(user => this.currentUserProfile?.receivedRequests?.includes(user.uid));
  }

  get friendsList(): UserProfileForFriends[] {
    return this.allUsers.filter(user => this.currentUserProfile?.friends?.includes(user.uid));
  }

  get otherUsers(): UserProfileForFriends[] {
    return this.allUsers.filter(user =>
      !this.isFriend(user) &&
      !this.isSentRequest(user) &&
      !this.isReceivedRequest(user) &&
      user.uid !== this.currentUserId // Ensure current user isn't in "other" list
    );
  }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }
}