import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firebase } from '../services/firebase';
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule } from '@angular/forms';
import { NgIf, NgClass, CommonModule } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box';
import { MatIcon } from '@angular/material/icon';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  bio: string;
  isPrivate: boolean;
  profilePictureUrl?: string;
  createdAt: any;
  role: 'user' | 'admin'; // Added role
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss'],
  standalone: true,
  imports: [
    FormsModule, NgIf, NgClass, CommonModule,
    MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatProgressBarModule,MatIcon,
    MessageBox
  ]
})
export class Profile implements OnInit, OnDestroy {
  userProfile: UserProfile | null = null;
  isEditing: boolean = false;
  isLoading: boolean = false;
  isUploadingPicture: boolean = false;
  pictureUploadProgress: number = 0;
  message: string = '';
  messageType: string = '';
  showMessageBox: boolean = false;

  // Temporary state for editing
  editDisplayName: string = '';
  editBio: string = '';
  editIsPrivate: boolean = false;
  selectedProfilePictureFile: File | null = null;
  profilePicturePreviewUrl: string | ArrayBuffer | null = null;

  // For account deletion
  showDeleteConfirmation: boolean = false;
  deleteEmail: string = '';
  deletePassword: string = '';
  isDeletingAccount: boolean = false;

  private userIdSubscription: Subscription | undefined;
  private profileSubscription: Subscription | undefined;
  private profilePictureUploadSubscription: Subscription | undefined;

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void {
    this.userIdSubscription = this.firebaseService.userId$.subscribe(userId => {
      if (userId) {
        this.isLoading = true; // Set loading true when user ID is available
        this.profileSubscription = this.firebaseService.getUserProfile(userId).subscribe({
            next: (profile) => {
                if (profile) {
                    this.userProfile = profile;
                    this.editDisplayName = profile.displayName || '';
                    this.editBio = profile.bio || '';
                    this.editIsPrivate = profile.isPrivate || false;
                    this.profilePicturePreviewUrl = profile.profilePictureUrl ?? null;
                    console.log('Real Firebase: Profile loaded:', this.userProfile);
                } else {
                    console.warn('Real Firebase: User profile not found in Firestore for current user. It might be created soon by auth listener.');
                    this.userProfile = null;
                }
                this.isLoading = false;
            },
            error: (error) => {
                console.error('Real Firebase: Error loading profile:', error);
                this.message = `Error loading profile: ${error.message}`;
                this.messageType = 'error';
                this.showMessageBox = true;
                this.isLoading = false;
            }
        });
      } else {
        this.userProfile = null;
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.userIdSubscription?.unsubscribe();
    this.profileSubscription?.unsubscribe();
    this.profilePictureUploadSubscription?.unsubscribe();
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.userProfile) {
      this.editDisplayName = this.userProfile.displayName;
      this.editBio = this.userProfile.bio;
      this.editIsPrivate = this.userProfile.isPrivate;
      this.selectedProfilePictureFile = null;
      this.profilePicturePreviewUrl = this.userProfile.profilePictureUrl ?? null;
      this.isUploadingPicture = false;
      this.pictureUploadProgress = 0;
    }
  }

  async saveProfile(): Promise<void> {
    if (!this.userProfile || !this.userProfile.uid) return;

    this.isLoading = true;
    this.message = '';
    this.messageType = '';
    this.showMessageBox = false;

    const updates: Partial<UserProfile> = {
      displayName: this.editDisplayName.trim(),
      bio: this.editBio.trim(),
      isPrivate: this.editIsPrivate
    };

    if (this.selectedProfilePictureFile && this.userProfile.uid) {
      this.isUploadingPicture = true;
      this.pictureUploadProgress = 0;
      try {
        await new Promise<void>((resolve, reject) => {
            this.profilePictureUploadSubscription = this.firebaseService.uploadProfilePicture(this.selectedProfilePictureFile!, this.userProfile!.uid).subscribe({
                next: (progress) => {
                    this.pictureUploadProgress = progress;
                    if (progress === 100) {
                        resolve();
                    }
                },
                error: (error) => {
                    console.error('Real Firebase: Profile picture upload failed:', error);
                    this.message = `Picture upload failed: ${error.message}`;
                    this.messageType = 'error';
                    this.showMessageBox = true;
                    this.isUploadingPicture = false;
                    reject(error);
                },
                complete: () => {
                    this.isUploadingPicture = false;
                    this.selectedProfilePictureFile = null;
                }
            });
        });
      } catch (e) {
        this.isLoading = false;
        return;
      } finally {
        this.pictureUploadProgress = 0;
      }
    }

    const hasOtherUpdates = Object.keys(updates).some(key => {
        const currentVal = this.userProfile ? (this.userProfile as any)[key] : undefined;
        const newVal = (updates as any)[key];
        return currentVal !== newVal;
    });

    if (!this.selectedProfilePictureFile || (this.selectedProfilePictureFile && hasOtherUpdates)) {
        try {
            const success = await this.firebaseService.updateUserProfile(this.userProfile.uid, updates).toPromise();

            if (success) {
              this.message = 'Profile updated successfully!';
              this.messageType = 'success';
              this.isEditing = false;
            } else {
              this.message = 'Failed to update profile.';
              this.messageType = 'error';
              this.showMessageBox = true;
            }
        } catch (error: any) {
            console.error('Real Firebase: Error updating profile (non-picture fields):', error);
            this.message = `Failed to update profile: ${error.message}`;
            this.messageType = 'error';
            this.showMessageBox = true;
        }
    }

    this.isLoading = false;
  }

  onProfilePictureSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      this.selectedProfilePictureFile = file;
      const reader = new FileReader();
      reader.onload = e => this.profilePicturePreviewUrl = reader.result;
      reader.readAsDataURL(file);
    } else {
      this.selectedProfilePictureFile = null;
      this.profilePicturePreviewUrl = this.userProfile?.profilePictureUrl ?? null;
      this.message = 'Please select an image file for profile picture.';
      this.messageType = 'error';
      this.showMessageBox = true;
    }
  }

  confirmDeleteAccount(): void {
    this.showDeleteConfirmation = true;
    this.message = '';
    this.messageType = '';
    this.showMessageBox = false;
    this.deleteEmail = this.userProfile?.email || ''; // Pre-fill email
    this.deletePassword = '';
  }

  cancelDeleteAccount(): void {
    this.showDeleteConfirmation = false;
    this.message = '';
  }

  async deleteAccount(): Promise<void> {
    if (!this.userProfile?.email || !this.deletePassword) {
      this.message = 'Please enter your email and password to confirm.';
      this.messageType = 'error';
      return;
    }

    this.isDeletingAccount = true;
    this.message = '';

    try {
      // Firebase service handles re-auth and deletion
      await this.firebaseService.deleteCurrentUser(this.userProfile.email, this.deletePassword).toPromise();
      this.message = 'Account deleted successfully!';
      this.messageType = 'success';
      this.showDeleteConfirmation = false;
      // App component will redirect to login on auth state change
    } catch (error: any) {
      console.error('Account deletion failed:', error);
      let errorMessage = 'Failed to delete account. Please try again.';
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log out and log in again to delete your account for security reasons.';
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      this.message = errorMessage;
      this.messageType = 'error';
      this.showMessageBox = true;
    } finally {
      this.isDeletingAccount = false;
    }
  }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }
}