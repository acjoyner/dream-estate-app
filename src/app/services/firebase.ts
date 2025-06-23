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
  reauthenticateWithCredential,
  deleteUser,
  EmailAuthProvider
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
  limit
} from '@angular/fire/firestore';

import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from '@angular/fire/storage';

import { BehaviorSubject, Observable, Subscription, from, combineLatest } from 'rxjs';
import { filter, switchMap, take, map } from 'rxjs/operators';

interface MediaItem {
  id: string;
  ownerId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'other';
  fileName: string;
  timestamp: any;
  likes: string[];
  likesCount: number;
}

// --- CRITICAL: UserProfile Interface with all necessary fields ---
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  bio: string;
  isPrivate: boolean;
  profilePictureUrl?: string; // Optional
  createdAt: any;
  role: 'user' | 'admin'; // <--- Ensure role is here
  friends: string[]; // <--- Ensure friends is here
  sentRequests: string[]; // <--- Ensure sentRequests is here
  receivedRequests: string[]; // <--- Ensure receivedRequests is here
  chatRooms: string[]; // <--- Ensure chatRooms is here
}

interface ChatRoom {
  id: string;
  participants: string[];
  createdAt: any;
  lastMessageTimestamp: any;
  lastMessageText?: string;
}

interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: any;
}

export interface ChatInitiationData {
  otherUserUid: string;
  otherUserName: string;
  otherUserPic?: string;
}

@Injectable({
  providedIn: 'root'
})
export class Firebase implements OnDestroy {
  public db: Firestore = inject(Firestore);
  public auth: Auth = inject(Auth);
  public storage: Storage = inject(Storage);
  

  private _userId = new BehaviorSubject<string | null>(null);
  public userId$: Observable<string | null> = this._userId.asObservable();

  private _isReady = new BehaviorSubject<boolean>(false);
  public isReady$: Observable<boolean> = this._isReady.asObservable();

  private _currentUserProfilePictureUrl = new BehaviorSubject<string | null>(null);
  public currentUserProfilePictureUrl$: Observable<string | null> = this._currentUserProfilePictureUrl.asObservable();

  private _isAdmin = new BehaviorSubject<boolean>(false);
  public isAdmin$: Observable<boolean> = this._isAdmin.asObservable();

  private _openChatWindowSubject = new BehaviorSubject<ChatInitiationData | null>(null);
  public openChatWindow$: Observable<ChatInitiationData | null> = this._openChatWindowSubject.asObservable();

  public canvasAppId: string;

  private authStateUnsubscribe: (() => void);
  private dataPopulationSubscription: Subscription;
  private userProfileUnsubscribe: (() => void) | undefined;
  private _isLoggingOut: boolean = false;

  constructor() {
    this.canvasAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-canvas-app-id';

    this.authStateUnsubscribe = onAuthStateChanged(this.auth, async (user: User | null) => {
      if (user) {
        this._userId.next(user.uid);
        this._isLoggingOut = false;
        console.log('Real Firebase: User signed in:', user.uid);

        const userDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', user.uid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
              await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email || 'N/A',
                displayName: user.displayName || `User_${user.uid.substring(0, 6)}`,
                bio: 'Hello, I am new here!',
                isPrivate: false,
                role: 'user', // Default role for new users
                friends: [],
                sentRequests: [],
                receivedRequests: [],
                chatRooms: [], // Initialize chatRooms for new users
                profilePictureUrl: user.photoURL || `https://placehold.co/80x80/FFD700/000000?text=${(user.displayName || user.email || user.uid).charAt(0).toUpperCase()}`,
                createdAt: serverTimestamp(),
              });
              console.log('Real Firebase: Created new user profile in Firestore.');
            } else {
                const existingProfile = userDocSnap.data() as UserProfile;
                if (user.photoURL && existingProfile.profilePictureUrl !== user.photoURL) {
                    await updateDoc(userDocRef, { profilePictureUrl: user.photoURL });
                }
                this._isAdmin.next(existingProfile.role === 'admin');
            }
        } catch (error: any) {
            console.error("Real Firebase: Error checking/creating user profile in onAuthStateChanged:", error);
        }

        if (this.userProfileUnsubscribe) {
            this.userProfileUnsubscribe();
        }
        this.userProfileUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
            const profileData = docSnap.data() as UserProfile; // Cast to full UserProfile
            this._currentUserProfilePictureUrl.next(profileData?.profilePictureUrl ?? null);
            this._isAdmin.next(profileData?.role === 'admin');
        }, (error: any) => {
            console.error("Real Firebase: Error listening to user profile changes:", error);
        });

      } else {
        this._userId.next(null);
        this._currentUserProfilePictureUrl.next(null);
        this._isAdmin.next(false);
        console.log('Real Firebase: User signed out or no user.');
        if (this.userProfileUnsubscribe) {
            this.userProfileUnsubscribe();
            this.userProfileUnsubscribe = undefined;
        }
        if (!this._isLoggingOut && this.auth.currentUser === null) {
             signInAnonymously(this.auth).catch((anonError: any) => {
                console.error('Real Firebase: Anonymous sign-in failed during onAuthStateChanged fallback:', anonError);
            });
        }
      }
      this._isReady.next(true);
      console.log('Real Firebase: Ready status:', true);
    }, (error: any) => {
        console.error("Real Firebase: onAuthStateChanged listener error:", error);
        this._isReady.next(true);
    });

    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      signInWithCustomToken(this.auth, __initial_auth_token).catch((error: any) => { console.error('Real Firebase: Custom token sign-in failed during initial attempt:', error); });
    }

    this.dataPopulationSubscription = this.isReady$.pipe(
        filter(ready => ready),
        switchMap(() => this.userId$.pipe(filter(userId => !!userId), take(1)))
    ).subscribe(async (currentUserId) => {
        console.log("Real Firebase: Attempting to populate initial mock listings data for user:", currentUserId);
        const listingsCollectionRef = collection(this.db, 'artifacts', this.canvasAppId, 'public/data/listings');
        try {
            const snapshot = await getDocs(listingsCollectionRef);
            if (snapshot.empty) {
                console.log("Real Firebase: No listings found. Populating mock data.");
                await this.populateMockListings(this.db, this.canvasAppId);
            } else {
                console.log("Real Firebase: Listings already exist. Skipping mock data population.");
            }
        } catch (e: any) {
            console.error("Real Firebase: Error checking for listings or populating mock data:", e);
        }
    });
  }

  ngOnDestroy(): void {
      this.authStateUnsubscribe();
      this.dataPopulationSubscription.unsubscribe();
      this.userProfileUnsubscribe?.();
      this._openChatWindowSubject.complete();
  }

  triggerOpenChatWindow(data: ChatInitiationData): void {
    this._openChatWindowSubject.next(data);
  }

  signUp(email: string, password: string): Observable<boolean> {
    return from(createUserWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(async (userCredential) => {
        const user = userCredential.user;
        if (user) {
          const userDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', user.uid);
          const defaultProfilePicture = `https://placehold.co/80x80/FFD700/000000?text=${(user.email || user.uid).charAt(0).toUpperCase()}`;
          await setDoc(userDocRef, {
            uid: user.uid, email: user.email || 'N/A', displayName: user.displayName || `User_${user.uid.substring(0, 6)}`, bio: 'Hello, I am new here!', isPrivate: false, role: 'user', friends: [], sentRequests: [], receivedRequests: [], chatRooms: [], profilePictureUrl: user.photoURL || defaultProfilePicture, createdAt: serverTimestamp(),
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
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(map(() => true), take(1));
  }

  logout(): Observable<void> {
    this._isLoggingOut = true;
    return from(signOut(this.auth)).pipe(take(1));
  }

  deleteCurrentUser(email: string, password: string): Observable<boolean> {
    return from(reauthenticateWithCredential(this.auth.currentUser!, EmailAuthProvider.credential(email, password))).pipe(
      switchMap(async () => {
        await deleteUser(this.auth.currentUser!);
        const userDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', this.auth.currentUser!.uid);
        await deleteDoc(userDocRef);
        console.log('Real Firebase: User profile document deleted.');
        return true;
      }),
      map(() => true),
      take(1)
    );
  }

  getUserProfile(uid: string): Observable<UserProfile | null> {
    const userDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', uid);
    return new Observable<UserProfile | null>(observer => {
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          observer.next(docSnap.data() as UserProfile);
        } else {
          observer.next(null);
        }
      }, (error: any) => { console.error("Error fetching user profile:", error); observer.error(error); });
      return unsubscribe;
    });
  }

  getAllUserProfiles(): Observable<UserProfile[]> {
    const usersCollectionRef = collection(this.db, 'artifacts', this.canvasAppId, 'users');
    const q = query(usersCollectionRef);

    return new Observable<UserProfile[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
        observer.next(users);
      }, (error: any) => { console.error("Error fetching all user profiles:", error); observer.error(error); });
      return unsubscribe;
    });
  }

  updateUserProfile(uid: string, updates: Partial<UserProfile>): Observable<boolean> {
    const userDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', uid);
    return from(updateDoc(userDocRef, updates as { [key: string]: any })).pipe(map(() => true), take(1));
  }

  sendFriendRequest(senderUid: string, receiverUid: string): Observable<boolean> {
    if (senderUid === receiverUid) { return from(Promise.reject(new Error("Cannot send friend request to yourself."))); }
    const senderDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', senderUid);
    const receiverDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', receiverUid);

    return from(getDoc(senderDocRef)).pipe(
      switchMap(async senderSnap => {
        const senderProfile = senderSnap.data() as UserProfile;
        if (senderProfile.friends.includes(receiverUid)) { throw new Error("Already friends."); }
        if (senderProfile.sentRequests.includes(receiverUid)) { throw new Error("Request already sent."); }
        if (senderProfile.receivedRequests.includes(receiverUid)) { throw new Error("User has already sent you a request. Accept instead."); }
        await updateDoc(senderDocRef, { sentRequests: arrayUnion(receiverUid) });
        await updateDoc(receiverDocRef, { receivedRequests: arrayUnion(senderUid) });
        return true;
      }),
      map(() => true), take(1)
    );
  }

  acceptFriendRequest(accepterUid: string, senderUid: string): Observable<boolean> {
    const accepterDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', accepterUid);
    const senderDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', senderUid);

    return from(getDoc(accepterDocRef)).pipe(
      switchMap(async accepterSnap => {
        const accepterProfile = accepterSnap.data() as UserProfile;
        if (!accepterProfile.receivedRequests.includes(senderUid)) { throw new Error("No pending request from this user."); }
        await updateDoc(accepterDocRef, { friends: arrayUnion(senderUid), receivedRequests: arrayRemove(senderUid) });
        await updateDoc(senderDocRef, { friends: arrayUnion(accepterUid), sentRequests: arrayRemove(accepterUid) });
        return true;
      }),
      map(() => true), take(1)
    );
  }

  rejectFriendRequest(rejecterUid: string, senderUid: string): Observable<boolean> {
    const rejecterDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', rejecterUid);
    return from(updateDoc(rejecterDocRef, { receivedRequests: arrayRemove(senderUid) })).pipe(
      switchMap(() => {
        const senderDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', senderUid);
        return from(updateDoc(senderDocRef, { sentRequests: arrayRemove(rejecterUid) }));
      }),
      map(() => true), take(1)
    );
  }

  removeFriend(user1Uid: string, user2Uid: string): Observable<boolean> {
    const user1DocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', user1Uid);
    const user2DocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', user2Uid);

    return from(updateDoc(user1DocRef, { friends: arrayRemove(user2Uid) })).pipe(
      switchMap(() => from(updateDoc(user2DocRef, { friends: arrayRemove(user1Uid) }))),
      map(() => true), take(1)
    );
  }

  getOrCreateChatRoom(currentUserUid: string, otherUserUid: string): Observable<string> {
    const participantUids = [currentUserUid, otherUserUid].sort();
    const chatRoomId = participantUids.join('_');
    const chatRoomDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'chatRooms', chatRoomId);
    const currentUserDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', currentUserUid);
    const otherUserDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', otherUserUid);

    return from(getDoc(chatRoomDocRef)).pipe(
      switchMap(async chatSnap => {
        if (!chatSnap.exists()) {
          await setDoc(chatRoomDocRef, { participants: participantUids, createdAt: serverTimestamp(), lastMessageTimestamp: serverTimestamp(), lastMessageText: "" });
          await updateDoc(currentUserDocRef, { chatRooms: arrayUnion(chatRoomId) });
          await updateDoc(otherUserDocRef, { chatRooms: arrayUnion(chatRoomId) });
          console.log('Real Firebase: Created new chat room:', chatRoomId);
        }
        return chatRoomId;
      }),
      take(1)
    );
  }

  sendMessage(chatRoomId: string, senderId: string, receiverId: string, text: string): Observable<boolean> {
    const messagesCollectionRef = collection(this.db, 'artifacts', this.canvasAppId, 'chatRooms', chatRoomId, 'messages');
    const chatRoomDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'chatRooms', chatRoomId);

    return from(addDoc(messagesCollectionRef, { senderId: senderId, receiverId: receiverId, text: text, timestamp: serverTimestamp() })).pipe(
      switchMap(async () => {
        await updateDoc(chatRoomDocRef, { lastMessageTimestamp: serverTimestamp(), lastMessageText: text });
        return true;
      }),
      take(1)
    );
  }

  getChatMessages(chatRoomId: string): Observable<ChatMessage[]> {
    const messagesCollectionRef = collection(this.db, 'artifacts', this.canvasAppId, 'chatRooms', chatRoomId, 'messages');
    const q = query(messagesCollectionRef, orderBy('timestamp', 'asc'));

    return new Observable<ChatMessage[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        observer.next(messages);
      }, (error: any) => { console.error("Real Firebase: Error fetching chat messages:", error); observer.error(error); });
      return unsubscribe;
    });
  }

  getAllChatRoomsForUser(userUid: string): Observable<ChatRoom[]> {
    const userDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'users', userUid);

    return new Observable<ChatRoom[]>(observer => {
      const userUnsubscribe = onSnapshot(userDocRef, (userDocSnap) => {
        if (userDocSnap.exists()) {
          const userProfile = userDocSnap.data() as UserProfile;
          const chatRoomIds = userProfile.chatRooms || [];

          if (chatRoomIds.length === 0) { observer.next([]); return; }

          const chatRoomsCollectionRef = collection(this.db, 'artifacts', this.canvasAppId, 'chatRooms');
          const q = query(chatRoomsCollectionRef, where('__name__', 'in', chatRoomIds));

          const chatRoomsUnsubscribe = onSnapshot(q, (chatRoomsSnapshot) => {
            const rooms = chatRoomsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom)).sort((a,b) => (b.lastMessageTimestamp?.toMillis() || 0) - (a.lastMessageTimestamp?.toMillis() || 0));
            observer.next(rooms);
          }, (error) => { console.error("Real Firebase: Error fetching user's chat rooms:", error); observer.error(error); });

          observer.add(() => chatRoomsUnsubscribe());
        } else { observer.next([]); }
      }, (error) => { console.error("Real Firebase: Error listening to user's chat rooms (via profile):", error); observer.error(error); });
      return userUnsubscribe;
    });
  }

  uploadProfilePicture(file: File, uid: string): Observable<number> {
    const filePath = `artifacts/<span class="math-inline">\{this\.canvasAppId\}/profile\_pictures/</span>{uid}/${file.name}`;
    const storageRef = ref(this.storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Observable<number>(observer => {
      uploadTask.on('state_changed',
        (snapshot) => { observer.next((snapshot.bytesTransferred / snapshot.totalBytes) * 100); },
        (error: any) => { console.error('Real Firebase: Profile picture upload failed:', error); observer.error(error); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          this.updateUserProfile(uid, { profilePictureUrl: downloadURL }).pipe(take(1)).subscribe({
            next: () => { observer.next(100); observer.complete(); },
            error: (updateError: any) => { console.error('Real Firebase: Failed to update profile with new picture URL:', updateError); observer.error(updateError); }
          });
        }
      );
    }).pipe(take(101));
  }

  getMediaItems(): Observable<MediaItem[]> {
    const mediaCollectionRef = collection(this.db, 'artifacts', this.canvasAppId, 'public/data/media');
    const q = query(mediaCollectionRef);

    return new Observable<MediaItem[]>(observer => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MediaItem)).sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        observer.next(items);
      }, (error: any) => { console.error("Real Firebase: Error fetching media items:", error); observer.error(error); });
      return unsubscribe;
    });
  }

  uploadMedia(file: File, ownerId: string, mediaType: 'image' | 'video' | 'other'): Observable<number> {
    const filePath = `artifacts/<span class="math-inline">\{this\.canvasAppId\}/public\_media/</span>{ownerId}_${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, file, { customMetadata: { ownerId: ownerId, mediaType: mediaType } });

    return new Observable<number>(observer => {
      uploadTask.on('state_changed',
        (snapshot) => { observer.next((snapshot.bytesTransferred / snapshot.totalBytes) * 100); },
        (error: any) => { console.error('Real Firebase: Media upload failed:', error); observer.error(error); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const mediaCollectionRef = collection(this.db, 'artifacts', this.canvasAppId, 'public/data/media');
          await addDoc(mediaCollectionRef, { id: mediaCollectionRef.id, ownerId: ownerId, mediaUrl: downloadURL, mediaType: mediaType, fileName: file.name, timestamp: serverTimestamp(), likes: [], likesCount: 0 }); // Added id to doc
          observer.next(100); observer.complete();
        }
      );
    }).pipe(take(101));
  }

  likeMedia(mediaId: string, userId: string): Observable<void> {
    const mediaDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'public/data/media', mediaId);
    return from(getDoc(mediaDocRef)).pipe(
      switchMap(async (docSnap) => {
        if (!docSnap.exists()) { throw new Error('Media item not found.'); }
        const data = docSnap.data() as MediaItem;
        let likes = data.likes || []; let likesCount = data.likesCount || 0;
        if (likes.includes(userId)) { likes = likes.filter((uid: string) => uid !== userId); likesCount = Math.max(0, likesCount - 1); } else { likes.push(userId); likesCount++; }
        await updateDoc(mediaDocRef, { likes: likes, likesCount: likesCount });
      }),
      map(() => {} ), take(1)
    );
  }

  deleteMedia(mediaItemId: string, ownerId: string, fileName: string): Observable<boolean> {
    const mediaDocRef = doc(this.db, 'artifacts', this.canvasAppId, 'public/data/media', mediaItemId);
    return from(getDoc(mediaDocRef)).pipe(
      switchMap(async (docSnap) => {
        if (!docSnap.exists()) { throw new Error('Media item not found in Firestore.'); }
        const mediaData = docSnap.data() as MediaItem; const mediaUrl = mediaData.mediaUrl;
        let fileRefPath: string | null = null;
        const storageUrlPrefix = `https://firebasestorage.googleapis.com/v0/b/${this.storage.app.options.storageBucket}/o/`;
        if (mediaUrl.startsWith(storageUrlPrefix)) {
          const encodedPath = mediaUrl.substring(storageUrlPrefix.length).split('?')[0];
          fileRefPath = decodeURIComponent(encodedPath);
        }
        if (!fileRefPath) { console.warn("Real Firebase: Could not parse storage path from mediaUrl. Falling back to constructed path."); }
        const storageRefToDelete = ref(this.storage, fileRefPath || `artifacts/<span class="math-inline">\{this\.canvasAppId\}/public\_media/</span>{ownerId}_${mediaData.fileName}`); // Fallback
        await deleteObject(storageRefToDelete); console.log('Real Firebase: Media file deleted from Storage.');
        await deleteDoc(mediaDocRef); console.log('Real Firebase: Media document deleted from Firestore.');
        return true;
      }),
      map(() => true), take(1)
    );
  }

  private async populateMockListings(db: Firestore, appId: string) {
    const listingsCollectionRef = collection(db, 'artifacts', appId, 'public/data/listings');
    const mockListings = [
      { address: '123 Pine St, Charlotte, NC 28202', price: '$450,000', beds: 3, baths: 2.5, sqft: 1800, description: 'Charming historic home in Uptown Charlotte. Walk to shops and restaurants. Recently renovated kitchen and baths.', mediaType: 'image', mediaUrl: 'https://placehold.co/600x400/FF5733/FFFFFF?text=Charlotte+Home+1', status: 'For Sale', city: 'Charlotte', state: 'NC', },
      { address: '666 Mountain View, Boone, NC 28607', price: '$480,000', beds: 2, baths: 2, sqft: 1200, description: 'Cozy cabin in the Blue Ridge Mountains. Ideal for nature lovers and adventurers. Features a stunning sunrise view.', mediaType: 'video', mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', status: 'For Sale', city: 'Boone', state: 'NC', },
      { address: '777 Ocean Breeze, Outer Banks, NC 27959', price: '$890,000', beds: 5, baths: 3.5, sqft: 2800, description: 'Stunning beachfront property with direct ocean access. Perfect for a luxury getaway or rental. Panoramic views.', mediaType: 'image', mediaUrl: 'https://placehold.co/600x400/87CEEB/FFFFFF?text=Outer+Banks+Beach+House', status: 'New Listing', city: 'Outer Banks', state: 'NC', },
    ];
    for (const listing of mockListings) {
      try {
        const q = query(listingsCollectionRef, where('address', '==', listing.address)); const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { await addDoc(listingsCollectionRef, { ...listing, timestamp: serverTimestamp() }); console.log(`Real Firebase: Added listing: ${listing.address}`); } else { console.log(`Real Firebase: Listing already exists, skipping: ${listing.address}`); }
      } catch (e: any) { console.error(`Real Firebase: Error adding listing ${listing.address}: `, e); }
    }
  }
}