import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firebase } from '../services/firebase'; // Real Firebase service
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgClass, NgIf } from '@angular/common';
import { MessageBox } from '../shared/message-box/message-box';

@Component({
  selector: 'app-media-upload',
  templateUrl: './media-upload.html',
  styleUrls: ['./media-upload.scss'],
  standalone: true,
  imports: [MatCardModule, MatProgressBarModule, MatButtonModule, MatIconModule, NgIf, MessageBox, NgClass]
})
export class MediaUpload implements OnInit, OnDestroy {
  selectedFile: File | null = null;
  uploadProgress: number = 0;
  isUploading: boolean = false;
  message: string = '';
  messageType: string = '';
  showMessageBox: boolean = false;

  currentUserId: string | null = null;
  isServiceReady: boolean = false;

  private userIdSubscription: Subscription | undefined;
  private isReadySubscription: Subscription | undefined;
  private uploadSubscription: Subscription | undefined;

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void {
    this.userIdSubscription = this.firebaseService.userId$.subscribe(userId => {
      this.currentUserId = userId;
    });
    this.isReadySubscription = this.firebaseService.isReady$.subscribe(isReady => {
      this.isServiceReady = isReady;
    });
  }

  ngOnDestroy(): void {
    this.userIdSubscription?.unsubscribe();
    this.isReadySubscription?.unsubscribe();
    this.uploadSubscription?.unsubscribe();
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
    this.uploadProgress = 0;
    this.message = '';
    this.messageType = '';
    this.showMessageBox = false;
  }

  uploadMedia(): void {
    if (!this.selectedFile) {
        this.message = 'Please select a file to upload.';
        this.messageType = 'error';
        this.showMessageBox = true;
        return;
    }
    if (!this.isServiceReady || !this.currentUserId) {
        this.message = 'Service not ready or user not authenticated. Please wait.';
        this.messageType = 'error';
        this.showMessageBox = true;
        return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;
    this.message = 'Uploading...';
    this.messageType = '';
    this.showMessageBox = false;

    const file = this.selectedFile;
    const mediaType = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'other');

    // Use real Firebase uploadMedia
    this.uploadSubscription = this.firebaseService.uploadMedia(file, this.currentUserId, mediaType).subscribe({
      next: (progress) => {
        this.uploadProgress = progress;
        console.log('Real Firebase: Upload is ' + progress + '% done');
      },
      error: (error) => {
        console.error('Real Firebase: Upload failed:', error);
        this.message = `Upload failed: ${error.message}`;
        this.messageType = 'error';
        this.isUploading = false;
        this.showMessageBox = true;
      },
      complete: () => {
        this.message = 'Upload successful!';
        this.messageType = 'success';
        this.selectedFile = null;
        this.isUploading = false;
        this.uploadProgress = 0;
        this.showMessageBox = true;
      }
    });
  }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }
}