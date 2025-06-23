import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { Firebase, OnlineStatus, UserProfile } from '../services/firebase'; // <--- Import UserProfile AND OnlineStatus from Firebase service
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, DatePipe, NgClass } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box';
import { MatSnackBar } from '@angular/material/snack-bar';

interface ChatMessageDisplay {
  id: string;
  chatRoomId: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: any;
  isCurrentUser: boolean;
}

interface UserProfileForDisplay {
  uid: string;
  displayName: string;
  profilePictureUrl?: string;
}

@Component({
  selector: 'app-chat-window',
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.scss'],
  standalone: true,
  imports: [
    NgIf, NgFor, DatePipe, NgClass, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MessageBox
  ]
})
export class ChatWindow implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @Input() chatRoomId: string | null = null;
  @Input() currentUserId: string | null = null;
  @Input() otherParticipantUid: string | null = null;
  @Input() otherParticipantName: string = '';
  @Input() otherParticipantPic?: string;
  @Output() closeChat = new EventEmitter<void>();

  messages: ChatMessageDisplay[] = [];
  newMessageText: string = '';
  isLoadingMessages: boolean = true;
  message: string = '';
  showMessageBox: boolean = false;

  otherParticipantOnlineStatus: OnlineStatus = { state: 'offline', timestamp: 0 };

  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  private messagesSubscription: Subscription | undefined;
  private allUsersMap: { [uid: string]: UserProfileForDisplay } = {};
  private allUsersSubscription: Subscription | undefined;
  private otherParticipantStatusSubscription: Subscription | undefined;

  constructor(private firebaseService: Firebase, private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.isLoadingMessages = true;
    this.allUsersSubscription = this.firebaseService.getAllUserProfiles().subscribe({
      next: (users) => {
        // FIX: Explicitly cast 'user' to UserProfile within the reduce callback and use dot notation
        this.allUsersMap = users.reduce((acc, userFromFirebase: UserProfile) => {
          acc[userFromFirebase.uid] = { // Use dot notation now that it's UserProfile
            uid: userFromFirebase.uid,
            displayName: userFromFirebase.displayName,
            profilePictureUrl: userFromFirebase.profilePictureUrl
          } as UserProfileForDisplay;
          return acc;
        }, {} as { [uid: string]: UserProfileForDisplay }); // Explicit type for accumulator
        this.subscribeToMessages();
      },
      error: (error: any) => {
        console.error("Error fetching all users for chat window:", error);
        this.message = `Error loading user info: ${error.message}`;
        this.showMessageBox = true;
        this.isLoadingMessages = false;
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chatRoomId'] && changes['chatRoomId'].currentValue !== changes['chatRoomId'].previousValue && this.chatRoomId) {
      this.subscribeToMessages();
    }
    if (changes['otherParticipantUid'] && changes['otherParticipantUid'].currentValue !== changes['otherParticipantUid'].previousValue && this.otherParticipantUid) {
      this.subscribeToOtherParticipantStatus(this.otherParticipantUid);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.scrollToBottom(), 0);
  }

  ngOnDestroy(): void {
    this.messagesSubscription?.unsubscribe();
    this.allUsersSubscription?.unsubscribe();
    this.otherParticipantStatusSubscription?.unsubscribe();
  }

  private subscribeToMessages(): void {
    if (!this.chatRoomId) {
      this.messages = [];
      this.isLoadingMessages = false;
      return;
    }

    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }

    this.isLoadingMessages = true;
    this.messagesSubscription = this.firebaseService.getChatMessages(this.chatRoomId).subscribe({
      next: (msgs) => {
        this.messages = msgs.map(msg => ({
          id: msg.id,
          chatRoomId: msg.chatRoomId,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          text: msg.text,
          timestamp: msg.timestamp,
          isCurrentUser: msg.senderId === this.currentUserId
        }));
        this.isLoadingMessages = false;
        setTimeout(() => this.scrollToBottom(), 0);
      },
      error: (error: any) => {
        console.error("Error fetching messages:", error);
        this.message = `Error loading messages: ${error.message}`;
        this.showMessageBox = true;
        this.isLoadingMessages = false;
      }
    });
  }

  private subscribeToOtherParticipantStatus(uid: string): void {
    if (this.otherParticipantStatusSubscription) {
      this.otherParticipantStatusSubscription.unsubscribe();
    }
    // This is correct now. It calls the method on firebaseService.
    this.otherParticipantStatusSubscription = this.firebaseService['getOnlineStatus'](uid).subscribe((status: OnlineStatus) => {
      this.otherParticipantOnlineStatus = status;
    });
  }

  private validateMessage(text: string): { isValid: boolean, errorMessage?: string } {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(text)) {
      return { isValid: false, errorMessage: "Links are not allowed in messages." };
    }
    if (text.length > 500) {
        return { isValid: false, errorMessage: "Message is too long." };
    }
    return { isValid: true };
  }

  async onSendMessage(): Promise<void> {
    if (!this.chatRoomId || !this.currentUserId || !this.otherParticipantUid || this.newMessageText.trim() === '') {
      this.snackBar.open('Cannot send empty message or chat not ready.', 'Dismiss', { duration: 3000, panelClass: ['snackbar-error'] });
      return;
    }

    const validation = this.validateMessage(this.newMessageText.trim());
    if (!validation.isValid) {
        this.snackBar.open(validation.errorMessage || "Message validation failed.", 'Dismiss', { duration: 5000, panelClass: ['snackbar-error'] });
        return;
    }

    try {
      await this.firebaseService.sendMessage(this.chatRoomId, this.currentUserId, this.otherParticipantUid, this.newMessageText.trim()).toPromise();
      this.newMessageText = '';
      setTimeout(() => this.scrollToBottom(), 0);
    } catch (error: any) {
      console.error("Error sending message:", error);
      this.snackBar.open(`Failed to send message: ${error.message}`, 'Dismiss', { duration: 5000, panelClass: ['snackbar-error'] });
    }
  }

  scrollToBottom(): void {
    try {
      if (this.messageContainer) {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Could not scroll to bottom:', err);
    }
  }

  getSenderDisplayName(senderId: string): string {
    return this.allUsersMap[senderId]?.displayName || 'Unknown User';
  }

  getSenderProfilePic(senderId: string): string | undefined {
    return this.allUsersMap[senderId]?.profilePictureUrl;
  }

  getOnlineStatusClass(status: OnlineStatus): string {
    switch (status.state) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  }

  onClose(): void {
    this.closeChat.emit();
  }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }

  trackByMessageId(index: number, message: ChatMessageDisplay): string {
    return message.id;
  }
}