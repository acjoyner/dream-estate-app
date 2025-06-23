import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { Firebase } from '../services/firebase';
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgIf, NgFor, AsyncPipe, DatePipe } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box'; // <--- ADDED: MessageBox import

interface UserProfileForDisplay {
  uid: string;
  displayName: string;
  profilePictureUrl?: string;
}

interface ChatRoomDisplay {
  id: string;
  participants: string[];
  lastMessageTimestamp: any;
  lastMessageText?: string;
  otherParticipantUid: string;
  otherParticipantName: string;
  otherParticipantPic?: string;
}

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.html',
  styleUrls: ['./chat-list.scss'],
  standalone: true,
  imports: [
    NgIf, NgFor, AsyncPipe, DatePipe,
    MatCardModule, MatListModule, MatButtonModule, MatIconModule,
    MessageBox // <--- ADDED: MessageBox to imports
  ]
})
export class ChatList implements OnInit, OnDestroy {
  @Output() selectChat = new EventEmitter<string>();
  @Input() currentUserId: string | null = null;

  chatRooms: ChatRoomDisplay[] = [];
  allUsersMap: { [uid: string]: UserProfileForDisplay } = {};
  isLoading: boolean = true;
  message: string = '';
  showMessageBox: boolean = false;

  private chatRoomsSubscription: Subscription | undefined;
  private allUsersSubscription: Subscription | undefined;

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void {
    this.isLoading = true;
    this.message = '';

    this.allUsersSubscription = this.firebaseService.getAllUserProfiles().subscribe({
      next: (users) => {
        this.allUsersMap = users.reduce((acc, user) => {
          acc[user.uid] = { uid: user.uid, displayName: user.displayName, profilePictureUrl: user.profilePictureUrl } as UserProfileForDisplay;
          return acc;
        }, {} as { [uid: string]: UserProfileForDisplay });
        this.subscribeToChatRooms();
      },
      error: (error) => {
        console.error("Error fetching all users for chat list:", error);
        this.message = `Error loading users for chat list: ${error.message}`;
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.chatRoomsSubscription?.unsubscribe();
    this.allUsersSubscription?.unsubscribe();
  }

  private subscribeToChatRooms(): void {
    if (!this.currentUserId) {
      this.isLoading = false;
      return;
    }

    if (this.chatRoomsSubscription) {
      this.chatRoomsSubscription.unsubscribe();
    }

    this.chatRoomsSubscription = this.firebaseService.getAllChatRoomsForUser(this.currentUserId).subscribe({
      next: (rooms) => {
        this.chatRooms = rooms.map(room => {
          const otherParticipantUid = room.participants.find(pUid => pUid !== this.currentUserId);
          const otherUser = otherParticipantUid ? this.allUsersMap[otherParticipantUid] : undefined;
          return {
            ...room,
            otherParticipantUid: otherParticipantUid || '',
            otherParticipantName: otherUser?.displayName || 'Unknown User',
            otherParticipantPic: otherUser?.profilePictureUrl
          };
        }).filter(room => room.otherParticipantUid !== '');

        this.isLoading = false;
        console.log("Chat Rooms Loaded:", this.chatRooms);
      },
      error: (error) => {
        console.error("Error fetching chat rooms:", error);
        this.message = `Error loading chat rooms: ${error.message}`;
        this.isLoading = false;
      }
    });
  }

  onSelectChat(chatRoomId: string): void {
    this.selectChat.emit(chatRoomId);
  }

  getParticipantInitial(displayName: string): string {
    return displayName?.charAt(0)?.toUpperCase() || '?';
  }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }

  // FIX: Add trackBy function for *ngFor in template
  trackByChatRoomId(index: number, room: ChatRoomDisplay): string {
    return room.id;
  }
}