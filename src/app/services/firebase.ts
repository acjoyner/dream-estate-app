import { Injectable, inject, OnDestroy } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  User,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider,
  UserCredential, // <--- Import UserCredential for precise typing
} from '@angular/fire/auth';

import {
  Firestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  serverTimestamp,
  getDocs,
  where,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  orderBy,
  limit,
  QueryDocumentSnapshot, // <--- Import QueryDocumentSnapshot for doc type
  DocumentData, // <--- Import DocumentData for doc.data() type
} from '@angular/fire/firestore';

import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from '@angular/fire/storage';

import {
  Database,
  getDatabase,
  onDisconnect,
  ref as rtdbRef,
  onValue,
  set,
  remove as rtdbRemove,
} from '@angular/fire/database';

import { BehaviorSubject, Observable, Subscription, from, Subject } from 'rxjs';
import { filter, switchMap, take, map, tap } from 'rxjs/operators';

// --- Interfaces ---
interface MediaItem {
  id: string;
  ownerId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'other';
  fileName: string;
  timestamp: any; // Firebase Timestamp type
  likes: string[];
  likesCount: number;
  caption?: string; // Optional caption for media items
}

// FIX: Define UserProfile with ALL properties, marking optional where they truly can be missing from Firestore
// This interface MUST match the exact shape of your Firestore user documents
export interface UserProfile {
  uid: string;
  email: string; // Firebase Auth email is always a string after creation
  displayName: string; // Always default in code if not provided
  bio: string; // Always default in code
  isPrivate: boolean; // Always default in code
  profilePictureUrl?: string; // Optional (can be missing)
  createdAt: any; // Firebase Timestamp - always set
  role: 'user' | 'admin'; // Always default in code if not provided, thus required here.
  friends: string[]; // Always initialize to [] in code
  sentRequests: string[]; // Always initialize to [] in code
  receivedRequests: string[]; // Always initialize to [] in code
  chatRooms: string[]; // Always initialize to [] in code
  lastOnline?: any; // Firebase Timestamp (optional)
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
  id: string; // Document ID (usually sorted UIDs: uid1_uid2)
  participants: string[];
  createdAt: any; // Firebase Timestamp
  lastMessageTimestamp: any; // Firebase Timestamp
  lastMessageText?: string;
}

interface ChatMessage {
  id: string; // Document ID
  chatRoomId: string; // ID of the chat room it belongs to
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: any; // Firebase Timestamp
}

export interface NewMessageNotification {
  chatRoomId: string;
  senderUid: string;
  senderName: string;
  messageText: string;
}

interface SocialAuthResult {
  success: boolean;
  isNewUser?: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class Firebase implements OnDestroy {
  public db: Firestore = inject(Firestore);
  public auth: Auth = inject(Auth);
  public storage: Storage = inject(Storage);
  public rtdb: Database = inject(Database);

  private _userId = new BehaviorSubject<string | null>(null);
  public userId$: Observable<string | null> = this._userId.asObservable();

  private _isReady = new BehaviorSubject<boolean>(false); // Starts as false for real Firebase
  public isReady$: Observable<boolean> = this._isReady.asObservable(); // FIX: Corrected to public observable

  private _currentUserProfilePictureUrl = new BehaviorSubject<string | null>(
    null
  );
  public currentUserProfilePictureUrl$: Observable<string | null> =
    this._currentUserProfilePictureUrl.asObservable();

  private _isAdmin = new BehaviorSubject<boolean>(false);
  public isAdmin$: Observable<boolean> = this._isAdmin.asObservable();

  private _openChatWindowSubject =
    new BehaviorSubject<ChatInitiationData | null>(null);
  public openChatWindow$: Observable<ChatInitiationData | null> =
    this._openChatWindowSubject.asObservable();

  private _newMessageNotificationSubject =
    new Subject<NewMessageNotification>();
  public newMessageNotification$: Observable<NewMessageNotification> =
    this._newMessageNotificationSubject.asObservable();

  private _currentlyOpenChatRoomId: string | null = null; // To track active chat for notification suppression

  public canvasAppId: string;
  private rtdbCanvasAppId: string; // RTDB-safe app ID (dots replaced with hyphens)

  private authStateUnsubscribe: () => void;
  private dataPopulationSubscription: Subscription;
  private userProfileUnsubscribe: (() => void) | undefined;
  private _isLoggingOut: boolean = false;

  private presenceRef: any; // RTDB reference to current user's presence node
  private disconnectedRef: any; // RTDB reference for onDisconnect
  private connectedRef: any; // RTDB reference to .info/connected
  private presenceSubscription: Subscription | undefined;

  constructor() {
    this.canvasAppId =
      typeof __app_id !== 'undefined' ? __app_id : 'default-canvas-app-id';
    this.rtdbCanvasAppId = this.canvasAppId.replace(/\./g, '-'); // Replace dots for RTDB keys

    console.log('Firebase Service Initialized.');
    console.log('Firestore/Storage Canvas App ID:', this.canvasAppId);
    console.log('RTDB Canvas App ID (safe for keys):', this.rtdbCanvasAppId);

    // --- Firebase Authentication State Listener (Central Auth Management) ---
    this.authStateUnsubscribe = onAuthStateChanged(
      this.auth,
      async (user: User | null) => {
        if (user) {
          this._userId.next(user.uid);
          this._isLoggingOut = false; // Reset logout flag when a user signs in
          console.log('Real Firebase: User signed in:', user.uid);

          const userDocRef = doc(
            this.db,
            'artifacts',
            this.canvasAppId,
            'users',
            user.uid
          );
          try {
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
              // User signed in (e.g., new social login) but no profile exists. Create one.
              await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email || 'N/A',
                displayName:
                  user.displayName ||
                  user.email?.split('@')[0] ||
                  `User_${user.uid.substring(0, 6)}`,
                bio: 'Hello, I am new here!',
                isPrivate: false,
                role: 'user',
                friends: [],
                sentRequests: [],
                receivedRequests: [],
                chatRooms: [],
                profilePictureUrl:
                  user.photoURL ||
                  `https://placehold.co/80x80/FFD700/000000?text=${(
                    user.displayName ||
                    user.email ||
                    user.uid
                  )
                    .charAt(0)
                    .toUpperCase()}`,
                createdAt: serverTimestamp(),
              });
              console.log(
                'Real Firebase: Created new user profile in Firestore.'
              );
            } else {
              const existingProfile = userDocSnap.data() as UserProfile; // Explicit cast
              // Access properties safely with optional chaining or nullish coalescing
              if (
                user.photoURL &&
                existingProfile.profilePictureUrl !== user.photoURL
              ) {
                await updateDoc(userDocRef, {
                  profilePictureUrl: user.photoURL,
                });
              }
              this._isAdmin.next(existingProfile.role === 'admin');
            }
          } catch (error: any) {
            console.error(
              'Real Firebase: Error checking/creating user profile in onAuthStateChanged:',
              error
            );
          }

          // --- Setup RTDB Presence for current user ---
          this.setupPresence(user.uid);

          // --- Real-time Listener for Current User's Firestore Profile ---
          if (this.userProfileUnsubscribe) {
            this.userProfileUnsubscribe();
          }
          this.userProfileUnsubscribe = onSnapshot(
            userDocRef,
            (docSnap) => {
              const profileData = docSnap.data() as UserProfile; // Explicit cast
              this._currentUserProfilePictureUrl.next(
                profileData?.profilePictureUrl ?? null
              );
              this._isAdmin.next(profileData?.role === 'admin');
            },
            (error: any) => {
              console.error(
                'Real Firebase: Error listening to user profile changes:',
                error
              );
            }
          );
        } else {
          // User is signed out or no user is currently logged in.
          this._userId.next(null);
          this._currentUserProfilePictureUrl.next(null);
          this._isAdmin.next(false); // Clear admin status
          console.log('Real Firebase: User signed out or no user.');

          // --- Clear Firestore Profile Listener on Logout ---
          if (this.userProfileUnsubscribe) {
            this.userProfileUnsubscribe();
            this.userProfileUnsubscribe = undefined;
          }

          // --- Clear RTDB Presence on Logout ---
          if (this.presenceRef) {
            set(this.presenceRef, { state: 'offline', timestamp: Date.now() });
          } // Set offline immediately
          if (this.disconnectedRef) {
            this.disconnectedRef.cancel();
          } // Cancel onDisconnect listener
          this.presenceSubscription?.unsubscribe();
          this.presenceSubscription = undefined;

          // --- Anonymous Sign-in for Unauthenticated Access ---
          if (!this._isLoggingOut && this.auth.currentUser === null) {
            signInAnonymously(this.auth).catch((anonError: any) => {
              console.error(
                'Real Firebase: Anonymous sign-in failed during onAuthStateChanged fallback:',
                anonError
              );
            });
          }
        }
        this._isReady.next(true); // Firebase is considered ready once initial auth state is determined
        console.log('Real Firebase: Ready status:', true);
      },
      (error: any) => {
        console.error(
          'Real Firebase: onAuthStateChanged listener error:',
          error
        );
        this._isReady.next(true);
      }
    );

    // --- Initial Authentication Attempt at Service Construction ---
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      signInWithCustomToken(this.auth, __initial_auth_token).catch(
        (error: any) => {
          console.error(
            'Real Firebase: Custom token sign-in failed during initial attempt:',
            error
          );
        }
      );
    }

    this.dataPopulationSubscription = this.isReady$
      .pipe(
        // Use isReady$ for the Observable
        filter((ready: boolean) => ready), // Explicitly type 'ready' parameter
        switchMap(() =>
          this.userId$.pipe(
            filter((userId) => !!userId),
            take(1)
          )
        )
      )
      .subscribe(async (currentUserId) => {
        console.log(
          'Real Firebase: Attempting to populate initial mock listings data for user:',
          currentUserId
        );
        const listingsCollectionRef = collection(
          this.db,
          'artifacts',
          this.canvasAppId,
          'public/data/listings'
        );
        try {
          const snapshot = await getDocs(listingsCollectionRef);
          if (snapshot.empty) {
            await this.populateMockListings(this.db, this.canvasAppId);
          } else {
            console.log(
              'Real Firebase: Listings already exist. Skipping mock data population.'
            );
          }
        } catch (e: any) {
          console.error(
            'Real Firebase: Error checking for listings or populating mock data:',
            e
          );
        }
      });
  }

  /**
   * Cleans up all active subscriptions and listeners when the service is destroyed.
   */
  ngOnDestroy(): void {
    this.authStateUnsubscribe();
    this.dataPopulationSubscription.unsubscribe();
    this.userProfileUnsubscribe?.();
    this._openChatWindowSubject.complete();
    this._newMessageNotificationSubject.complete(); // Complete notification subject

    if (this.presenceRef) {
      set(this.presenceRef, { state: 'offline', timestamp: Date.now() });
    }
    if (this.disconnectedRef) {
      this.disconnectedRef.cancel();
    }
    this.presenceSubscription?.unsubscribe();
  }

  setCurrentlyOpenChatRoom(chatRoomId: string | null): void {
    this._currentlyOpenChatRoomId = chatRoomId;
    console.log('Firebase: Currently open chat room set to:', chatRoomId);
  }

  triggerOpenChatWindow(data: ChatInitiationData): void {
    console.log(
      'Firebase Service: Triggering open chat window with data:',
      data
    );
    this._openChatWindowSubject.next(data);
  }

  // --- Authentication Methods (Email/Password & Social) ---

  signUp(email: string, password: string): Observable<boolean> {
    return from(
      createUserWithEmailAndPassword(this.auth, email, password)
    ).pipe(
      switchMap(async (userCredential) => {
        const user = userCredential.user;
        if (user) {
          const userDocRef = doc(
            this.db,
            'artifacts',
            this.canvasAppId,
            'users',
            user.uid
          );
          const defaultProfilePicture = `https://placehold.co/80x80/FFD700/000000?text=${(
            user.email || user.uid
          )
            .charAt(0)
            .toUpperCase()}`;
          await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email || 'N/A', // Set email as N/A if null
            displayName:
              user.displayName ||
              user.email?.split('@')[0] ||
              `User_${user.uid.substring(0, 6)}`, // Set default displayName
            bio: 'Hello, I am new here!',
            isPrivate: false,
            role: 'user', // Set default role
            friends: [],
            sentRequests: [],
            receivedRequests: [],
            chatRooms: [],
            profilePictureUrl: user.photoURL || defaultProfilePicture,
            createdAt: serverTimestamp(),
          });
          return true;
        }
        return false;
      }),
      map(() => true),
      take(1)
    );
  }

  login(email: string, password: string): Observable<boolean> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      map(() => true),
      take(1)
    );
  }

  logout(): Observable<void> {
    this._isLoggingOut = true; // Set flag to prevent immediate anonymous sign-in
    return from(signOut(this.auth)).pipe(
      map(() => {}),
      take(1)
    );
  }

  deleteCurrentUser(email: string, password: string): Observable<boolean> {
    return from(
      reauthenticateWithCredential(
        this.auth.currentUser!,
        EmailAuthProvider.credential(email, password)
      )
    ).pipe(
      switchMap(async () => {
        await deleteUser(this.auth.currentUser!); // Delete Auth user
        const userDocRef = doc(
          this.db,
          'artifacts',
          this.canvasAppId,
          'users',
          this.auth.currentUser!.uid
        );
        await deleteDoc(userDocRef); // Delete user's profile document from Firestore
        console.log('Real Firebase: User profile document deleted.');
        return true;
      }),
      map(() => true),
      take(1)
    );
  }

  // async googleSignIn(): Promise<SocialAuthResult> {
  //   console.log('Real Firebase: googleSignIn method called.');
  //   try {
  //     const provider = new GoogleAuthProvider();
  //     const credential = await signInWithPopup(this.auth, provider);
  //     // FIX: Access additionalUserInfo correctly (it's optional on UserCredential directly)
  //     const isNewUser = (credential.additionalUserInfo as any)?.isNewUser || false; // Cast to any to access additionalUserInfo
  //     console.log('Real Firebase: Google Sign-in successful:', credential.user.uid, 'is new user:', isNewUser);
  //     return { success: true, isNewUser: isNewUser };
  //   } catch (error: any) {
  //     console.error('Real Firebase: Google Sign-in failed in service method:', error);
  //     return { success: false, error: error.message };
  //   }
  // }

  // async appleSignIn(): Promise<SocialAuthResult> {
  //   console.log('Real Firebase: Apple Sign-in method called.');
  //   try {
  //     const provider = new OAuthProvider('apple.com');
  //     const credential = await signInWithPopup(this.auth, provider);
  //     // FIX: Access additionalUserInfo correctly
  //     const isNewUser = (credential.additionalUserInfo as any)?.isNewUser || false; // Cast to any to access additionalUserInfo
  //     console.log('Real Firebase: Apple Sign-in successful:', credential.user.uid, 'is new user:', isNewUser);
  //     return { success: true, isNewUser: isNewUser };
  //   } catch (error: any) {
  //     console.error('Real Firebase: Apple Sign-in failed in service method:', error);
  //     return { success: false, error: error.message };
  //   }
  // }

  // --- Realtime Database Presence Management ---
  private setupPresence(uid: string): void {
  console.log('Setting up RTDB presence for user:', uid);

  const rtdbPath = `onlineUsers/${this.rtdbCanvasAppId}/${uid}`;
  this.presenceRef = rtdbRef(this.rtdb, rtdbPath);
  this.disconnectedRef = rtdbRef(this.rtdb, rtdbPath);

  // ✅ Corrected onDisconnect usage
  onDisconnect(this.disconnectedRef)
    .set({ state: 'offline', timestamp: Date.now() })
    .catch((error) => console.error('onDisconnect error:', error));

  set(this.presenceRef, { state: 'online', timestamp: Date.now() });

  this.connectedRef = rtdbRef(this.rtdb, '.info/connected');

  this.presenceSubscription = new Observable<boolean>((observer) => {
    const unsubscribe = onValue(this.connectedRef, (snapshot) => {
      observer.next(snapshot.val() as boolean);
    });
    return unsubscribe;
  })
    .pipe(
      tap((connected: boolean) => {
        const userDocRef = doc(
          this.db,
          'artifacts',
          this.canvasAppId,
          'users',
          uid
        );
        if (connected) {
          set(this.presenceRef, {
            state: 'online',
            timestamp: Date.now(),
          });
          updateDoc(userDocRef, { lastOnline: serverTimestamp() }).catch((e) =>
            console.error('Firestore lastOnline update failed:', e)
          );
        } else {
          updateDoc(userDocRef, { lastOnline: serverTimestamp() }).catch((e) =>
            console.error('Firestore lastOnline update failed:', e)
          );
        }
      })
    )
    .subscribe();
}

  getOnlineStatus(uid: string): Observable<OnlineStatus> {
    const userStatusRef = rtdbRef(
      this.rtdb,
      `onlineUsers/${this.rtdbCanvasAppId}/${uid}`
    );
    return new Observable<OnlineStatus>((observer) => {
      const unsubscribe = onValue(
        userStatusRef,
        (snapshot) => {
          const status = snapshot.val() as OnlineStatus;
          observer.next(status || { state: 'offline', timestamp: 0 });
        },
        (error: any) => {
          console.error('RTDB Error getting online status:', error);
          observer.error(error);
        }
      );
      return unsubscribe;
    });
  }

  // --- Firestore Data Management Methods ---

  getUserProfile(uid: string): Observable<UserProfile | null> {
    const userDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      uid
    );
    return new Observable<UserProfile | null>((observer) => {
      const unsubscribe = onSnapshot(
        userDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            observer.next(docSnap.data() as UserProfile); // Cast to UserProfile
          } else {
            observer.next(null);
          }
        },
        (error: any) => {
          console.error('Error fetching user profile:', error);
          observer.error(error);
        }
      );
      return unsubscribe;
    });
  }

  getAllUserProfiles(): Observable<UserProfile[]> {
    const usersCollectionRef = collection(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users'
    );
    const q = query(usersCollectionRef); // No order by to avoid index requirement for simple fetch

    return new Observable<UserProfile[]>((observer) => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // FIX: Ensure each doc.data() is explicitly cast to UserProfile with all properties
          const users = snapshot.docs.map((docSnapshot) => {
            // Renamed param to avoid conflict with imported doc
            const data = docSnapshot.data(); // Get DocumentData
            return {
              uid: docSnapshot.id, // Doc ID is the UID
              email: data['email'] || 'N/A',
              displayName:
                data['displayName'] || `User_${docSnapshot.id.substring(0, 6)}`,
              bio: data['bio'] || '',
              isPrivate: data['isPrivate'] || false,
              profilePictureUrl: data['profilePictureUrl'] || undefined, // undefined if truly optional
              createdAt: data['createdAt'] || null, // Default to null if missing
              role: data['role'] || 'user', // Default role
              friends: data['friends'] || [],
              sentRequests: data['sentRequests'] || [],
              receivedRequests: data['receivedRequests'] || [],
              chatRooms: data['chatRooms'] || [],
              lastOnline: data['lastOnline'] || null, // Optional
            } as UserProfile; // Final cast to UserProfile
          });
          observer.next(users);
        },
        (error: any) => {
          console.error('Error fetching all user profiles:', error);
          observer.error(error);
        }
      );
      return unsubscribe;
    });
  }

  updateUserProfile(
    uid: string,
    updates: Partial<UserProfile>
  ): Observable<boolean> {
    const userDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      uid
    );
    return from(updateDoc(userDocRef, updates as { [key: string]: any })).pipe(
      map(() => true),
      take(1)
    );
  }

  // --- Friend System Methods ---
  sendFriendRequest(
    senderUid: string,
    receiverUid: string
  ): Observable<boolean> {
    if (senderUid === receiverUid) {
      return from(
        Promise.reject(new Error('Cannot send friend request to yourself.'))
      );
    }
    const senderDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      senderUid
    );
    const receiverDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      receiverUid
    );

    return from(getDoc(senderDocRef)).pipe(
      switchMap(async (senderSnap) => {
        const senderProfile = senderSnap.data() as UserProfile;
        if (
          senderProfile.friends &&
          senderProfile.friends.includes(receiverUid)
        ) {
          throw new Error('Already friends.');
        }
        if (
          senderProfile.sentRequests &&
          senderProfile.sentRequests.includes(receiverUid)
        ) {
          throw new Error('Request already sent.');
        }
        if (
          senderProfile.receivedRequests &&
          senderProfile.receivedRequests.includes(receiverUid)
        ) {
          throw new Error(
            'User has already sent you a request. Accept instead.'
          );
        }

        await updateDoc(senderDocRef, {
          sentRequests: arrayUnion(receiverUid),
        });
        await updateDoc(receiverDocRef, {
          receivedRequests: arrayUnion(senderUid),
        });
        return true;
      }),
      map(() => true),
      take(1)
    );
  }

  acceptFriendRequest(
    accepterUid: string,
    senderUid: string
  ): Observable<boolean> {
    const accepterDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      accepterUid
    );
    const senderDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      senderUid
    );

    return from(getDoc(accepterDocRef)).pipe(
      switchMap(async (accepterSnap) => {
        const accepterProfile = accepterSnap.data() as UserProfile;
        if (
          !accepterProfile.receivedRequests ||
          !accepterProfile.receivedRequests.includes(senderUid)
        ) {
          throw new Error('No pending request from this user.');
        }

        await updateDoc(accepterDocRef, {
          friends: arrayUnion(senderUid),
          receivedRequests: arrayRemove(senderUid),
        });
        await updateDoc(senderDocRef, {
          friends: arrayUnion(accepterUid),
          sentRequests: arrayRemove(accepterUid),
        });
        return true;
      }),
      map(() => true),
      take(1)
    );
  }

  rejectFriendRequest(
    rejecterUid: string,
    senderUid: string
  ): Observable<boolean> {
    const rejecterDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      rejecterUid
    );
    return from(
      updateDoc(rejecterDocRef, {
        receivedRequests: arrayRemove(senderUid),
      })
    ).pipe(
      switchMap(async () => {
        const senderDocRef = doc(
          this.db,
          'artifacts',
          this.canvasAppId,
          'users',
          senderUid
        );
        await updateDoc(senderDocRef, {
          sentRequests: arrayRemove(rejecterUid),
        });
        return true;
      }),
      map(() => true),
      take(1)
    );
  }

  removeFriend(user1Uid: string, user2Uid: string): Observable<boolean> {
    const user1DocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      user1Uid
    );
    const user2DocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      user2Uid
    );

    return from(
      updateDoc(user1DocRef, { friends: arrayRemove(user2Uid) })
    ).pipe(
      switchMap(async () => {
        await updateDoc(user2DocRef, { friends: arrayRemove(user1Uid) });
        return true;
      }),
      map(() => true),
      take(1)
    );
  }

  // --- Messaging Methods (Chat Rooms and Messages) ---
  getOrCreateChatRoom(
    currentUserUid: string,
    otherUserUid: string
  ): Observable<string> {
    const participantUids = [currentUserUid, otherUserUid].sort();
    const chatRoomId = participantUids.join('_');
    const chatRoomDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'chatRooms',
      chatRoomId
    );
    const currentUserDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      currentUserUid
    );
    const otherUserDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      otherUserUid
    );

    return from(getDoc(chatRoomDocRef)).pipe(
      switchMap(async (chatSnap) => {
        if (!chatSnap.exists()) {
          await setDoc(chatRoomDocRef, {
            participants: participantUids,
            createdAt: serverTimestamp(),
            lastMessageTimestamp: serverTimestamp(),
            lastMessageText: '',
          });
          await updateDoc(currentUserDocRef, {
            chatRooms: arrayUnion(chatRoomId),
          });
          await updateDoc(otherUserDocRef, {
            chatRooms: arrayUnion(chatRoomId),
          });
          console.log('Real Firebase: Created new chat room:', chatRoomId);
        }
        return chatRoomId;
      }),
      take(1)
    );
  }

  sendMessage(
    chatRoomId: string,
    senderId: string,
    receiverId: string,
    text: string
  ): Observable<boolean> {
    const messagesCollectionRef = collection(
      this.db,
      'artifacts',
      this.canvasAppId,
      'chatRooms',
      chatRoomId,
      'messages'
    );
    const chatRoomDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'chatRooms',
      chatRoomId
    );

    return from(
      addDoc(messagesCollectionRef, {
        senderId: senderId,
        receiverId: receiverId,
        text: text,
        timestamp: serverTimestamp(),
      })
    ).pipe(
      switchMap(async () => {
        await updateDoc(chatRoomDocRef, {
          lastMessageTimestamp: serverTimestamp(),
          lastMessageText: text,
        });
        return true;
      }),
      map(() => true),
      take(1)
    );
  }

  /**
   * Fetches messages for a specific chat room in real-time.
   * Modified to trigger New Message Notifications.
   * @param chatRoomId The ID of the chat room.
   * @returns An Observable of chat messages.
   */
  getChatMessages(chatRoomId: string): Observable<ChatMessage[]> {
    const messagesCollectionRef = collection(
      this.db,
      'artifacts',
      this.canvasAppId,
      'chatRooms',
      chatRoomId,
      'messages'
    );
    const q = query(messagesCollectionRef, orderBy('timestamp', 'asc'));

    let initialLoad = true; // To prevent notifications on initial load of messages
    let previousMessageCount = 0; // To track new messages

    return new Observable<ChatMessage[]>((observer) => {
      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          const messages = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as ChatMessage)
          );

          const currentUserId = this.auth.currentUser?.uid; // Get current user's UID
          if (
            !initialLoad &&
            messages.length > previousMessageCount &&
            currentUserId
          ) {
            const newMessage = messages[messages.length - 1]; // Get the very last message
            if (
              newMessage.senderId !== currentUserId &&
              this._currentlyOpenChatRoomId !== chatRoomId
            ) {
              const senderProfileSnap = await getDoc(
                doc(
                  this.db,
                  'artifacts',
                  this.canvasAppId,
                  'users',
                  newMessage.senderId
                )
              );
              const senderName =
                (senderProfileSnap.data() as UserProfile)?.displayName ||
                'Unknown Sender';
              this._newMessageNotificationSubject.next({
                chatRoomId: newMessage.chatRoomId,
                senderUid: newMessage.senderId,
                senderName: senderName,
                messageText: newMessage.text,
              });
              console.log('NEW MESSAGE NOTIFICATION:', newMessage.text);
            }
          }
          previousMessageCount = messages.length;
          initialLoad = false;

          observer.next(messages);
        },
        (error: any) => {
          console.error('Real Firebase: Error fetching chat messages:', error);
          observer.error(error);
        }
      );
      return unsubscribe;
    });
  }

  getAllChatRoomsForUser(userUid: string): Observable<ChatRoom[]> {
    const userDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'users',
      userUid
    );

    return new Observable<ChatRoom[]>((observer) => {
      const userUnsubscribe = onSnapshot(
        userDocRef,
        (userDocSnap) => {
          if (userDocSnap.exists()) {
            const userProfile = userDocSnap.data() as UserProfile;
            const chatRoomIds = userProfile.chatRooms || [];

            if (chatRoomIds.length === 0) {
              observer.next([]);
              return;
            }

            const chatRoomsCollectionRef = collection(
              this.db,
              'artifacts',
              this.canvasAppId,
              'chatRooms'
            );
            const q = query(
              chatRoomsCollectionRef,
              where('__name__', 'in', chatRoomIds)
            );

            const chatRoomsUnsubscribe = onSnapshot(
              q,
              (chatRoomsSnapshot) => {
                const rooms = chatRoomsSnapshot.docs
                  .map((doc) => ({ id: doc.id, ...doc.data() } as ChatRoom))
                  .sort(
                    (a, b) =>
                      (b.lastMessageTimestamp?.toMillis() || 0) -
                      (a.lastMessageTimestamp?.toMillis() || 0)
                  );
                observer.next(rooms);
              },
              (error) => {
                console.error(
                  "Real Firebase: Error fetching user's chat rooms:",
                  error
                );
                observer.error(error);
              }
            );

            observer.add(() => chatRoomsUnsubscribe());
          } else {
            observer.next([]);
          }
        },
        (error) => {
          console.error(
            "Real Firebase: Error listening to user's chat rooms (via profile):",
            error
          );
          observer.error(error);
        }
      );

      return userUnsubscribe;
    });
  }

  // --- Media (Profile Pictures & General Media) Methods ---
  uploadProfilePicture(file: File, uid: string): Observable<number> {
    const filePath = `artifacts/${this.canvasAppId}/profile_pictures/${uid}/${file.name}`;
    const storageRef = ref(this.storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Observable<number>((observer) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          observer.next(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
        },
        (error: any) => {
          console.error('Real Firebase: Profile picture upload failed:', error);
          observer.error(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          this.updateUserProfile(uid, { profilePictureUrl: downloadURL })
            .pipe(take(1))
            .subscribe({
              next: () => {
                observer.next(100);
                observer.complete();
              },
              error: (updateError: any) => {
                console.error(
                  'Real Firebase: Failed to update profile with new picture URL:',
                  updateError
                );
                observer.error(updateError);
              },
            });
        }
      );
    }).pipe(take(101));
  }

  getMediaItems(): Observable<MediaItem[]> {
    const mediaCollectionRef = collection(
      this.db,
      'artifacts',
      this.canvasAppId,
      'public/data/media'
    );
    const q = query(mediaCollectionRef);

    return new Observable<MediaItem[]>((observer) => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as MediaItem))
            .sort(
              (a, b) =>
                (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
            );
          observer.next(items);
        },
        (error: any) => {
          console.error('Real Firebase: Error fetching media items:', error);
          observer.error(error);
        }
      );
      return unsubscribe;
    });
  }

  uploadMedia(
    file: File,
    ownerId: string,
    mediaType: 'image' | 'video' | 'other',
    caption?: string
  ): Observable<number> {
    const filePath = `artifacts/${
      this.canvasAppId
    }/public_media/${ownerId}_${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      customMetadata: { ownerId: ownerId, mediaType: mediaType },
    });

    return new Observable<number>((observer) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          observer.next(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
        },
        (error: any) => {
          console.error('Real Firebase: Media upload failed:', error);
          observer.error(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const mediaCollectionRef = collection(
            this.db,
            'artifacts',
            this.canvasAppId,
            'public/data/media'
          );
          await addDoc(mediaCollectionRef, {
            id: mediaCollectionRef.id,
            ownerId: ownerId,
            mediaUrl: downloadURL,
            mediaType: mediaType,
            fileName: file.name,
            timestamp: serverTimestamp(),
            likes: [],
            likesCount: 0,
         
          });
          observer.next(100);
          observer.complete();
        }
      );
    }).pipe(take(101));
  }

  likeMedia(mediaId: string, userId: string): Observable<void> {
    const mediaDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'public/data/media',
      mediaId
    );
    return from(getDoc(mediaDocRef)).pipe(
      switchMap(async (docSnap) => {
        if (!docSnap.exists()) {
          throw new Error('Media item not found.');
        }
        const data = docSnap.data() as MediaItem;
        let likes = data.likes || [];
        let likesCount = data.likesCount || 0;
        if (likes.includes(userId)) {
          likes = likes.filter((uid: string) => uid !== userId);
          data.likesCount = Math.max(0, data.likesCount - 1);
        } else {
          likes.push(userId);
          data.likesCount++;
        }
        await updateDoc(mediaDocRef, {
          likes: likes,
          likesCount: data.likesCount,
        });
      }),
      map(() => {}),
      take(1)
    );
  }

  deleteMedia(
    mediaItemId: string,
    ownerId: string,
    fileName: string
  ): Observable<boolean> {
    const mediaDocRef = doc(
      this.db,
      'artifacts',
      this.canvasAppId,
      'public/data/media',
      mediaItemId
    );
    return from(getDoc(mediaDocRef)).pipe(
      switchMap(async (docSnap) => {
        if (!docSnap.exists()) {
          throw new Error('Media item not found in Firestore.');
        }
        const mediaData = docSnap.data() as MediaItem;
        const mediaUrl = mediaData.mediaUrl;

        let fileRefPath: string | null = null;
        const storageUrlPrefix = `https://firebasestorage.googleapis.com/v0/b/${
          (this.storage as any)._delegate.app.options.storageBucket
        }/o/`;
        if (mediaUrl.startsWith(storageUrlPrefix)) {
          const encodedPath = mediaUrl
            .substring(storageUrlPrefix.length)
            .split('?')[0];
          fileRefPath = decodeURIComponent(encodedPath);
        }
        if (!fileRefPath) {
          console.warn(
            'Real Firebase: Could not parse storage path from mediaUrl. Falling back to constructed path.'
          );
        }
        const storageRefToDelete = ref(
          this.storage,
          fileRefPath ||
            `artifacts/${this.canvasAppId}/public_media/${ownerId}_${mediaData.fileName}`
        ); // Fallback

        await deleteObject(storageRefToDelete);
        console.log('Real Firebase: Media file deleted from Storage.');
        await deleteDoc(mediaDocRef);
        console.log('Real Firebase: Media document deleted from Firestore.');
        return true;
      }),
      map(() => true),
      take(1)
    );
  }

  // Private helper method to populate initial mock listings if the collection is empty.
  private async populateMockListings(
    db: Firestore,
    appId: string
  ): Promise<void> {
    const listingsCollectionRef = collection(
      db,
      'artifacts',
      appId,
      'public/data/listings'
    );

    const mockListings = [
      {
        address: '123 Pine St, Charlotte, NC 28202',
        price: '$450,000',
        beds: 3,
        baths: 2.5,
        sqft: 1800,
        description:
          'Charming historic home in Uptown Charlotte. Walk to shops and restaurants. Recently renovated kitchen and baths.',
        mediaType: 'image',
        mediaUrl:
          'https://placehold.co/600x400/FF5733/FFFFFF?text=Charlotte+Home+1',
        status: 'For Sale',
        city: 'Charlotte',
        state: 'NC',
      },
      {
        address: '666 Mountain View, Boone, NC 28607',
        price: '$480,000',
        beds: 2,
        baths: 2,
        sqft: 1200,
        description:
          'Cozy cabin in the Blue Ridge Mountains. Ideal for nature lovers and adventurers. Features a stunning sunrise view.',
        mediaType: 'video',
        mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        status: 'For Sale',
        city: 'Boone',
        state: 'NC',
      },
      {
        address: '777 Ocean Breeze, Outer Banks, NC 27959',
        price: '$890,000',
        beds: 5,
        baths: 3.5,
        sqft: 2800,
        description:
          'Stunning beachfront property with direct ocean access. Perfect for a luxury getaway or rental. Panoramic views.',
        mediaType: 'image',
        mediaUrl:
          'https://placehold.co/600x400/87CEEB/FFFFFF?text=Outer+Banks+Beach+House',
        status: 'New Listing',
        city: 'Outer Banks',
        state: 'NC',
      },
    ];

    for (const listing of mockListings) {
      try {
        const q = query(
          listingsCollectionRef,
          where('address', '==', listing.address)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          await addDoc(listingsCollectionRef, {
            ...listing,
            timestamp: serverTimestamp(),
          });
          console.log(`Real Firebase: Added listing: ${listing.address}`);
        } else {
          console.log(
            `Real Firebase: Listing already exists, skipping: ${listing.address}`
          );
        }
      } catch (e: any) {
        console.error(
          `Real Firebase: Error adding listing ${listing.address}: `,
          e
        );
      }
    }
  }
}
