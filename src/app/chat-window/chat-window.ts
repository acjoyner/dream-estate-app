import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { Firebase } from '../services/firebase';
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, DatePipe, NgClass } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box'; // <--- ADDED: MessageBox import

interface ChatMessageDisplay {
  id: string;
  senderId: string;
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
    MessageBox // <--- ADDED: MessageBox to imports
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

  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  private messagesSubscription: Subscription | undefined;
  private allUsersMap: { [uid: string]: UserProfileForDisplay } = {};
  private allUsersSubscription: Subscription | undefined;

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void {
    this.isLoadingMessages = true;
    this.allUsersSubscription = this.firebaseService.getAllUserProfiles().subscribe({
      next: (users) => {
        this.allUsersMap = users.reduce((acc, user) => {
          acc[user.uid] = { uid: user.uid, displayName: user.displayName, profilePictureUrl: user.profilePictureUrl } as UserProfileForDisplay;
          return acc;
        }, {} as { [uid: string]: UserProfileForDisplay });
        this.subscribeToMessages();
      },
      error: (error) => {
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
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.messagesSubscription?.unsubscribe();
    this.allUsersSubscription?.unsubscribe();
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
          ...msg,
          isCurrentUser: msg.senderId === this.currentUserId
        }));
        this.isLoadingMessages = false;
        setTimeout(() => this.scrollToBottom(), 0);
      },
      error: (error) => {
        console.error("Error fetching messages:", error);
        this.message = `Error loading messages: ${error.message}`;
        this.showMessageBox = true;
        this.isLoadingMessages = false;
      }
    });
  }

  async onSendMessage(): Promise<void> {
    if (!this.chatRoomId || !this.currentUserId || !this.otherParticipantUid || this.newMessageText.trim() === '') {
      this.message = 'Cannot send empty message or chat not ready.';
      this.showMessageBox = true;
      return;
    }

    try {
      await this.firebaseService.sendMessage(this.chatRoomId, this.currentUserId, this.otherParticipantUid, this.newMessageText.trim()).toPromise();
      this.newMessageText = '';
      setTimeout(() => this.scrollToBottom(), 0);
    } catch (error: any) {
      console.error("Error sending message:", error);
      this.message = `Failed to send message: ${error.message}`;
      this.showMessageBox = true;
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

  onClose(): void {
    this.closeChat.emit();
  }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }

  // FIX: Add trackBy function for *ngFor in template
  trackByMessageId(index: number, message: ChatMessageDisplay): string {
    return message.id;
  }
}