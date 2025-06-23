import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of, timer, Subscription, Subject } from 'rxjs'; // Added Subject
import { delay, map, take } from 'rxjs/operators';

interface MediaItem {
  id: string;
  ownerId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'other';
  fileName: string;
  timestamp: Date; // Date for mock
  likes: string[];
  likesCount: number;
}

interface MockUser {
  uid: string;
  email: string;
  password?: string;
  displayName: string;
  bio: string;
  isPrivate: boolean;
  profilePictureUrl?: string;
  role: 'user' | 'admin';
  friends: string[];
  sentRequests: string[];
  receivedRequests: string[];
  chatRooms: string[];
}

export interface OnlineStatus {
  state: 'online' | 'away' | 'offline';
  timestamp: number; // Unix timestamp
}

export interface ChatInitiationData {
  otherUserUid: string;
  otherUserName: string;
  otherUserPic?: string;
}

interface ChatRoom {
  id: string;
  participants: string[];
  createdAt: Date; // Date for mock
  lastMessageTimestamp: Date; // Date for mock
  lastMessageText?: string;
}

interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: Date; // Date for mock
}

export interface UserProfile { // <--- MUST HAVE 'export'
  uid: string;
  email: string;
  displayName: string;
  bio: string;
  isPrivate: boolean;
  profilePictureUrl?: string;
  createdAt: any;
  role: 'user' | 'admin';
  friends: string[];
  sentRequests: string[];
  receivedRequests: string[];
  chatRooms: string[];
  lastOnline?: any;
}

export interface NewMessageNotification {
  chatRoomId: string;
  senderUid: string;
  senderName: string;
  messageText: string;
}

@Injectable({
  providedIn: 'root'
})
export class Firebase implements OnDestroy {
  // No inject() needed for mock service as it doesn't interact with real Firebase SDK directly
  // No Firestore, Auth, Storage, RTDB properties here in mock mode

  // Authentication and Service Readiness State (Mocked)
  private _userId = new BehaviorSubject<string | null>(null);
  public userId$: Observable<string | null> = this._userId.asObservable();

  private _isReady = new BehaviorSubject<boolean>(true); // Mock service is always ready
  public isReady$: Observable<boolean> = this._isReady.asObservable();

  private _currentUserProfilePictureUrl = new BehaviorSubject<string | null>(null);
  public currentUserProfilePictureUrl$: Observable<string | null> = this._currentUserProfilePictureUrl.asObservable();

  private _isAdmin = new BehaviorSubject<boolean>(false); // Mock admin status
  public isAdmin$: Observable<boolean> = this._isAdmin.asObservable();

  private _openChatWindowSubject = new BehaviorSubject<ChatInitiationData | null>(null);
  public openChatWindow$: Observable<ChatInitiationData | null> = this._openChatWindowSubject.asObservable();

  private _newMessageNotificationSubject = new Subject<NewMessageNotification>(); // Uses Subject for notifications
  public newMessageNotification$: Observable<NewMessageNotification> = this._newMessageNotificationSubject.asObservable();

  private _currentlyOpenChatRoomId: string | null = null; // To track active chat for notification suppression

  public canvasAppId: string = 'mock-app-id'; // A dummy app ID for mock data

  // In-memory store for mock users (simulates a user database with profiles)
  private mockUsers: MockUser[] = [
    { uid: 'mockUser_abc123', email: 'test@example.com', password: 'password123', displayName: 'Test User', bio: 'Exploring mock real estate!', isPrivate: false, role: 'user', friends: ['mockUser_def456'], sentRequests: [], receivedRequests: [], chatRooms: ['mockUser_abc123_mockUser_def456'], profilePictureUrl: 'https://placehold.co/80x80/6A0DAD/FFFFFF?text=TU' },
    { uid: 'mockUser_def456', email: 'another@example.com', password: 'password123', displayName: 'Another User', bio: 'Always looking for new properties.', isPrivate: false, role: 'user', friends: ['mockUser_abc123'], sentRequests: [], receivedRequests: [], chatRooms: ['mockUser_abc123_mockUser_def456'], profilePictureUrl: 'https://placehold.co/80x80/FF6347/FFFFFF?text=AU' },
    { uid: 'mockUser_ghi789', email: 'admin@example.com', password: 'password123', displayName: 'Admin User', bio: 'I manage the properties!', isPrivate: false, role: 'admin', friends: [], sentRequests: [], receivedRequests: [], chatRooms: [], profilePictureUrl: 'https://placehold.co/80x80/3CB371/FFFFFF?text=AD' }, // Mock Admin User
    { uid: 'mockUser_jkl012', email: 'newuser@example.com', password: 'password123', displayName: 'New User', bio: 'Just joined!', isPrivate: false, role: 'user', friends: [], sentRequests: ['mockUser_mnopqrs'], receivedRequests: [], chatRooms: [], profilePictureUrl: 'https://placehold.co/80x80/FFA500/000000?text=NU' },
    { uid: 'mockUser_mnopqrs', email: 'pending@example.com', password: 'password123', displayName: 'Pending Request', bio: 'Waiting for friends.', isPrivate: false, role: 'user', friends: [], sentRequests: [], receivedRequests: ['mockUser_jkl012'], chatRooms: [], profilePictureUrl: 'https://placehold.co/80x80/8A2BE2/FFFFFF?text=PR' },
  ];

  // In-memory store for mock media items
  private mockMediaItems = new BehaviorSubject<MediaItem[]>([
    { id: 'mock_media_1', ownerId: 'mockUser_abc123', mediaUrl: 'https://placehold.co/600x400/FF5733/FFFFFF?text=Charlotte+Home+1', mediaType: 'image', fileName: 'home1.png', timestamp: new Date(Date.now() - 86400000), likes: ['mockUser_abc123', 'mockUser_def456'], likesCount: 2 },
    { id: 'mock_media_2', ownerId: 'mockUser_def456', mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', mediaType: 'video', fileName: 'promo.mp4', timestamp: new Date(Date.now() - 3600000), likes: ['mockUser_abc123'], likesCount: 1 },
    { id: 'mock_media_3', ownerId: 'mockUser_abc123', mediaUrl: 'https://placehold.co/600x400/33C7FF/000000?text=My+Own+Upload', mediaType: 'image', fileName: 'upload.png', timestamp: new Date(Date.now() - 7200000), likes: ['mockUser_def456'], likesCount: 1 },
  ]);

  // In-memory store for mock chat rooms and messages
  private mockChatRooms: ChatRoom[] = [
    {
      id: 'mockUser_abc123_mockUser_def456',
      participants: ['mockUser_abc123', 'mockUser_def456'],
      createdAt: new Date(Date.now() - 100000),
      lastMessageTimestamp: new Date(Date.now() - 5000),
      lastMessageText: "Hey there! How's it going?"
    }
  ];
  private mockChatMessages: { [chatRoomId: string]: ChatMessage[] } = {
    'mockUser_abc123_mockUser_def456': [
      { id: 'msg_1', chatRoomId: 'mockUser_abc123_mockUser_def456', senderId: 'mockUser_abc123', receiverId: 'mockUser_def456', text: 'Hi!', timestamp: new Date(Date.now() - 10000) },
      { id: 'msg_2', chatRoomId: 'mockUser_abc123_mockUser_def456', senderId: 'mockUser_def456', receiverId: 'mockUser_abc123', text: 'Hey there! How\'s it going?', timestamp: new Date(Date.now() - 5000) }
    ]
  };

  // In-memory store for mock online status (RTDB simulation)
  private mockOnlineStatus: { [uid: string]: OnlineStatus } = {
    'mockUser_abc123': { state: 'online', timestamp: Date.now() },
    'mockUser_def456': { state: 'away', timestamp: Date.now() - 300000 }, // 5 mins away
    'mockUser_ghi789': { state: 'offline', timestamp: Date.now() - 3600000 }, // 1 hour offline
  };


  constructor() {
    console.log("--- Initializing MOCK Firebase Service ---");
    // Simulate initial user login/ready state (e.g., test@example.com auto-logs in)
    // Auto-login a default user for testing the UI.
    this.loginMock('test@example.com', 'password123').subscribe();
  }

  ngOnDestroy(): void {
    console.log("--- MOCK Firebase Service Destroyed ---");
    this._openChatWindowSubject.complete();
    this._newMessageNotificationSubject.complete(); // Complete notification subject
  }

  /**
   * Sets the ID of the chat room currently open in the UI.
   * Used to suppress notifications for the active chat.
   * @param chatRoomId The ID of the currently open chat room, or null if no chat is open.
   */
  setCurrentlyOpenChatRoom(chatRoomId: string | null): void {
    this._currentlyOpenChatRoomId = chatRoomId;
    console.log('Mock: Currently open chat room set to:', chatRoomId);
  }

  /**
   * Triggers the opening of the chat window with specific participant data.
   * @param data ChatInitiationData containing details of the other participant.
   */
  triggerOpenChatWindow(data: ChatInitiationData): void {
    console.log('Mock Firebase Service: Triggering open chat window with data:', data);
    this._openChatWindowSubject.next(data);
  }

  // --- Authentication Methods (Mocked) ---
  signUp(email: string, password: string): Observable<boolean> {
    return this.signUpMock(email, password);
  }

  login(email: string, password: string): Observable<boolean> {
    return this.loginMock(email, password);
  }

  logout(): Observable<void> {
    return this.logoutMock();
  }

  deleteCurrentUser(email: string, password: string): Observable<boolean> {
    return of(null).pipe(
      delay(1500),
      map(() => {
        const userIndex = this.mockUsers.findIndex(u => u.email === email && u.password === password && u.uid === this._userId.getValue());
        if (userIndex > -1) {
          this.mockUsers.splice(userIndex, 1); // Remove from mock users
          this._userId.next(null); // Log out
          console.log('Mock Delete User successful.');
          return true;
        }
        console.warn('Mock Delete User failed: User not found or credentials invalid.');
        return false;
      })
    );
  }

  // --- User Profile Methods (Mocked) ---
  getUserProfile(uid: string): Observable<UserProfile | null> {
    return of(null).pipe(
      delay(200),
      map(() => {
        const user = this.mockUsers.find(u => u.uid === uid);
        // Return a deep copy to simulate Firestore behavior (immutable objects)
        return user ? JSON.parse(JSON.stringify(user)) as UserProfile : null;
      })
    );
  }

  getAllUserProfiles(): Observable<UserProfile[]> {
    return of(null).pipe(
      delay(300),
      map(() => JSON.parse(JSON.stringify(this.mockUsers)) as UserProfile[]) // Return deep copy
    );
  }

  updateUserProfile(uid: string, updates: Partial<UserProfile>): Observable<boolean> {
    return of(null).pipe(
      delay(500),
      map(() => {
        const userIndex = this.mockUsers.findIndex(u => u.uid === uid);
        if (userIndex > -1) {
          // Simulate profile picture update if it's in updates
          if (updates['profilePictureUrl'] !== undefined) {
            this._currentUserProfilePictureUrl.next(updates['profilePictureUrl'] as string ?? null);
          }
          // Simulate admin role update if it's in updates
          if (updates['role'] !== undefined) {
            this._isAdmin.next(updates['role'] === 'admin');
          }
          // Apply updates
          this.mockUsers[userIndex] = { ...this.mockUsers[userIndex], ...updates };
          console.log('Mock Profile updated:', this.mockUsers[userIndex]);
          return true;
        }
        return false;
      })
    );
  }

  // --- Realtime Database Presence Management (Mocked) ---
  getOnlineStatus(uid: string): Observable<OnlineStatus> {
    return new Observable<OnlineStatus>(observer => {
      // Simulate online/offline status changes (initial state + delayed changes)
      observer.next(this.mockOnlineStatus[uid] || { state: 'offline', timestamp: 0 });

      // Simulate status changes over time
      const interval = setInterval(() => {
        const currentStatus = this.mockOnlineStatus[uid] || { state: 'offline', timestamp: 0 };
        let nextState: 'online' | 'away' | 'offline';
        switch (currentStatus.state) {
          case 'online': nextState = 'away'; break;
          case 'away': nextState = 'offline'; break;
          case 'offline': nextState = 'online'; break;
        }
        this.mockOnlineStatus[uid] = { state: nextState, timestamp: Date.now() };
        observer.next(this.mockOnlineStatus[uid]);
      }, 10000); // Change status every 10 seconds

      return () => clearInterval(interval); // Cleanup interval on unsubscribe
    });
  }


  // --- Friend System Methods (Mocked) ---
  sendFriendRequest(senderUid: string, receiverUid: string): Observable<boolean> {
    return of(null).pipe(
      delay(500),
      map(() => {
        const sender = this.mockUsers.find(u => u.uid === senderUid);
        const receiver = this.mockUsers.find(u => u.uid === receiverUid);
        if (!sender || !receiver) { throw new Error("Sender or receiver not found."); }
        if (sender.friends.includes(receiverUid)) { throw new Error("Already friends."); }
        if (sender.sentRequests.includes(receiverUid)) { throw new Error("Request already sent."); }
        if (sender.receivedRequests.includes(receiverUid)) { throw new Error("User has already sent you a request. Accept instead."); }

        sender.sentRequests.push(receiverUid);
        receiver.receivedRequests.push(senderUid);
        console.log(`Mock Request sent: ${senderUid} -> ${receiverUid}`);
        return true;
      })
    );
  }

  acceptFriendRequest(accepterUid: string, senderUid: string): Observable<boolean> {
    return of(null).pipe(
      delay(500),
      map(() => {
        const accepter = this.mockUsers.find(u => u.uid === accepterUid);
        const sender = this.mockUsers.find(u => u.uid === senderUid);
        if (!accepter || !sender) { throw new Error("Accepter or sender not found."); }
        if (!accepter.receivedRequests.includes(senderUid)) { throw new Error("No pending request from this user."); }

        accepter.receivedRequests = accepter.receivedRequests.filter(uid => uid !== senderUid);
        sender.sentRequests = sender.sentRequests.filter(uid => uid !== accepterUid);

        accepter.friends.push(senderUid);
        sender.friends.push(accepterUid);
        console.log(`Mock Request accepted: ${accepterUid} <- ${senderUid}`);
        return true;
      })
    );
  }

  rejectFriendRequest(rejecterUid: string, senderUid: string): Observable<boolean> {
    return of(null).pipe(
      delay(500),
      map(() => {
        const rejecter = this.mockUsers.find(u => u.uid === rejecterUid);
        const sender = this.mockUsers.find(u => u.uid === senderUid);
        if (!rejecter || !sender) { throw new Error("Rejecter or sender not found."); }
        if (!rejecter.receivedRequests.includes(senderUid)) { throw new Error("No pending request from this user."); }

        rejecter.receivedRequests = rejecter.receivedRequests.filter(uid => uid !== senderUid);
        sender.sentRequests = sender.sentRequests.filter(uid => uid !== rejecterUid);
        console.log(`Mock Request rejected: ${rejecterUid} X ${senderUid}`);
        return true;
      })
    );
  }

  removeFriend(user1Uid: string, user2Uid: string): Observable<boolean> {
    return of(null).pipe(
      delay(500),
      map(() => {
        const user1 = this.mockUsers.find(u => u.uid === user1Uid);
        const user2 = this.mockUsers.find(u => u.uid === user2Uid);
        if (!user1 || !user2) { throw new Error("User not found."); }

        user1.friends = user1.friends.filter(uid => uid !== user2Uid);
        user2.friends = user2.friends.filter(uid => uid !== user1Uid);
        console.log(`Mock Friend removed: ${user1Uid} X ${user2Uid}`);
        return true;
      })
    );
  }

  // --- Messaging Methods (Mocked) ---
  getOrCreateChatRoom(currentUserUid: string, otherUserUid: string): Observable<string> {
    const participantUids = [currentUserUid, otherUserUid].sort();
    const chatRoomId = participantUids.join('_');

    return of(null).pipe(
      delay(500),
      map(() => {
        let room = this.mockChatRooms.find(r => r.id === chatRoomId);
        if (!room) {
          room = { id: chatRoomId, participants: participantUids, createdAt: new Date(), lastMessageTimestamp: new Date(), lastMessageText: "" };
          this.mockChatRooms.push(room);

          const currentUser = this.mockUsers.find(u => u.uid === currentUserUid);
          const otherUser = this.mockUsers.find(u => u.uid === otherUserUid);
          if (currentUser) { currentUser.chatRooms = currentUser.chatRooms || []; if (!currentUser.chatRooms.includes(chatRoomId)) currentUser.chatRooms.push(chatRoomId); }
          if (otherUser) { otherUser.chatRooms = otherUser.chatRooms || []; if (!otherUser.chatRooms.includes(chatRoomId)) otherUser.chatRooms.push(chatRoomId); }

          console.log('Mock Created new chat room:', chatRoomId);
        }
        return chatRoomId;
      }),
      take(1)
    );
  }

  sendMessage(chatRoomId: string, senderId: string, receiverId: string, text: string): Observable<boolean> {
    return of(null).pipe(
      delay(200),
      map(() => {
        this.mockChatMessages[chatRoomId] = this.mockChatMessages[chatRoomId] || [];
        const newMessage: ChatMessage = { id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`, chatRoomId, senderId, receiverId, text, timestamp: new Date() };
        this.mockChatMessages[chatRoomId].push(newMessage);

        const room = this.mockChatRooms.find(r => r.id === chatRoomId);
        if (room) {
          room.lastMessageTimestamp = newMessage.timestamp;
          room.lastMessageText = newMessage.text;
        }

        // --- NEW: Simulate message notification for other user ---
        const currentUserId = this._userId.getValue();
        // Check if receiver is not current user and the chat window is not currently open for this chat
        if (receiverId === currentUserId && this._currentlyOpenChatRoomId !== chatRoomId) {
            const senderUser = this.mockUsers.find(u => u.uid === senderId);
            if (senderUser) {
                this._newMessageNotificationSubject.next({
                    chatRoomId: chatRoomId,
                    senderUid: senderId,
                    senderName: senderUser.displayName,
                    messageText: text
                });
                console.log('Mock: NEW MESSAGE NOTIFICATION triggered.');
            }
        }
        // --- END NEW: Simulate message notification ---

        console.log('Mock Message sent:', newMessage);
        return true;
      }),
      take(1)
    );
  }

  getChatMessages(chatRoomId: string): Observable<ChatMessage[]> {
    return of(null).pipe(
      delay(100),
      map(() => {
        const messages = this.mockChatMessages[chatRoomId] || [];
        return JSON.parse(JSON.stringify(messages)) as ChatMessage[];
      })
    );
  }

  getAllChatRoomsForUser(userUid: string): Observable<ChatRoom[]> {
    return of(null).pipe(
      delay(200),
      map(() => {
        const user = this.mockUsers.find(u => u.uid === userUid);
        if (!user) { return []; }
        const userChatRoomIds = user.chatRooms || [];
        const rooms = this.mockChatRooms.filter(room => userChatRoomIds.includes(room.id));
        rooms.sort((a, b) => b.lastMessageTimestamp.getTime() - a.lastMessageTimestamp.getTime());
        return JSON.parse(JSON.stringify(rooms)) as ChatRoom[];
      })
    );
  }

  // --- Media (Profile Pictures & General Media) Methods (Mocked) ---
  uploadProfilePicture(file: File, uid: string): Observable<number> {
    return timer(0, 50).pipe(
      take(21),
      map(i => {
        const progress = i * 5;
        if (progress === 100) {
          const mockImageUrl = `https://placehold.co/150x150/<span class="math-inline">\{Math\.floor\(Math\.random\(\) \* 16777215\)\.toString\(16\)\}/FFFFFF?text\=</span>{uid.substring(9, 12).toUpperCase()}`;
          this.updateUserProfile(uid, { profilePictureUrl: mockImageUrl }).subscribe();
        }
        return progress;
      })
    );
  }

  getMediaItems(): Observable<MediaItem[]> {
    return this.mockMediaItems.asObservable().pipe(
      delay(100),
      map(items => JSON.parse(JSON.stringify(items)).sort((a: MediaItem, b: MediaItem) => b.timestamp.getTime() - a.timestamp.getTime()))
    );
  }

  uploadMedia(file: File, ownerId: string, mediaType: 'image' | 'video' | 'other'): Observable<number> {
    return timer(0, 50).pipe(
      take(21),
      map(i => {
        const progress = i * 5;
        if (progress === 100) {
          const newMediaId = `mock_media_${Date.now()}`;
          const newMediaItem: MediaItem = {
            id: newMediaId, ownerId: ownerId,
            mediaUrl: mediaType === 'image' ? `https://placehold.co/600x400/A2D2FF/000000?text=Uploaded+${file.name.slice(0, 10)}...` : 'https://www.w3schools.com/html/mov_bbb.mp4',
            mediaType: mediaType, fileName: file.name, timestamp: new Date(), likes: [], likesCount: 0
          };
          this.mockMediaItems.next([...this.mockMediaItems.getValue(), newMediaItem]);
          console.log('Mock Upload complete:', newMediaItem);
        }
        return progress;
      })
    );
  }

  likeMedia(mediaId: string, userId: string): Observable<void> {
    return of(null).pipe(
      delay(200),
      map(() => {
        const currentItems = this.mockMediaItems.getValue();
        const itemIndex = currentItems.findIndex(item => item.id === mediaId);
        if (itemIndex > -1) {
          const item = { ...currentItems[itemIndex] };
          item.likes = item.likes ? [...item.likes] : []; item.likesCount = item.likesCount || 0;
          if (item.likes.includes(userId)) { item.likes = item.likes.filter((uid: string) => uid !== userId); item.likesCount = Math.max(0, item.likesCount - 1); } else { item.likes.push(userId); item.likesCount++; }
          const updatedItems = [...currentItems]; updatedItems[itemIndex] = item;
          this.mockMediaItems.next(updatedItems);
          console.log('Mock Liked/Unliked:', item);
        }
      })
    );
  }

  deleteMedia(mediaItemId: string, ownerId: string, fileName: string): Observable<boolean> {
    return of(null).pipe(
      delay(500),
      map(() => {
        const initialLength = this.mockMediaItems.getValue().length;
        this.mockMediaItems.next(this.mockMediaItems.getValue().filter(item => item.id !== mediaItemId));
        console.log(`Mock Deleted media: ${fileName}`);
        return this.mockMediaItems.getValue().length < initialLength;
      })
    );
  }


  // --- Private Mock Helper Methods ---
  private signUpMock(email: string, password: string): Observable<boolean> {
    return of(null).pipe(
      delay(1000),
      map(() => {
        if (this.mockUsers.some(u => u.email === email)) { console.warn('Mock SignUp failed: Email already in use.'); return false; }
        const newUid = `mockUser_${Math.random().toString(36).substring(2, 11)}`;
        const defaultProfilePicture = `https://placehold.co/80x80/FFD700/000000?text=${newUid.substring(9, 11).toUpperCase()}`;
        const newMockUser: MockUser = {
          uid: newUid, email: email, password: password, displayName: `User_${newUid.substring(9, 15)}`, bio: 'New user, exploring!', isPrivate: false, role: 'user', friends: [], sentRequests: [], receivedRequests: [], chatRooms: [], profilePictureUrl: defaultProfilePicture
        };
        this.mockUsers.push(newMockUser);
        this._userId.next(newUid);
        this._currentUserProfilePictureUrl.next(newMockUser.profilePictureUrl ?? null);
        console.log('Mock SignUp successful:', newUid);
        return true;
      })
    );
  }

  private loginMock(email: string, password: string): Observable<boolean> {
    return of(null).pipe(
      delay(1000),
      map(() => {
        const user = this.mockUsers.find(u => u.email === email && u.password === password);
        if (user) {
          this._userId.next(user.uid);
          this._currentUserProfilePictureUrl.next(user.profilePictureUrl ?? null);
          this._isAdmin.next(user.role === 'admin');
          console.log('Mock Login successful:', user.uid);
          return true;
        } else { console.warn('Mock Login failed: Invalid credentials.'); return false; }
      })
    );
  }

  private logoutMock(): Observable<void> {
    return of(null).pipe(
      delay(500),
      map(() => {
        this._userId.next(null);
        this._currentUserProfilePictureUrl.next(null);
        this._isAdmin.next(false);
        console.log('Mock Logout successful.');
      })
    );
  }

  // Populate mock listings (only for initial setup if Firestore collection is empty - unused in mock)
  private async populateMockListings(): Promise<void> {
    // This method is only used in the real Firebase setup.
    // In the mock context, mockMediaItems is already populated.
    console.log("Mock: populateMockListings is called but does nothing in mock mode.");
  }
}


