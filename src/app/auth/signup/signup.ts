import { Component, OnInit } from '@angular/core';
import { Firebase } from '../../services/firebase'; // Real Firebase service
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { NgClass, NgIf } from '@angular/common';
import { MessageBox } from '../../shared/message-box/message-box';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss'],
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, NgIf,
    MessageBox, NgClass
  ]
})
export class Signup implements OnInit {
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  isLoading: boolean = false;
  message: string = '';
  messageType: string = '';
  showMessageBox: boolean = false;

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void { }

  async onSignup(): Promise<void> {
    this.isLoading = true;
    this.message = '';
    this.messageType = '';
    this.showMessageBox = false;

    if (this.password !== this.confirmPassword) {
      this.message = 'Passwords do not match.';
      this.messageType = 'error';
      this.showMessageBox = true;
      this.isLoading = false;
      return;
    }
    if (this.password.length < 6) {
      this.message = 'Password must be at least 6 characters long.';
      this.messageType = 'error';
      this.showMessageBox = true;
      this.isLoading = false;
      return;
    }

    try {
      // Use real Firebase signup method
      const success = await this.firebaseService.signUp(this.email, this.password).toPromise();
      if (success) {
        this.message = 'Signup successful! You are now logged in.';
        this.messageType = 'success';
      } else {
        this.message = 'Signup failed: Email may already exist or invalid.';
        this.messageType = 'error';
        this.showMessageBox = true;
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      let errorMessage = 'Signup failed.';
      if (error.code) {
        // Firebase Auth error codes
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Email already in use. Please try logging in or use a different email.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address format.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Must be at least 6 characters.';
            break;
          default:
            errorMessage = `Signup failed: ${error.message}`;
        }
      }
      this.message = errorMessage;
      this.messageType = 'error';
      this.showMessageBox = true;
    } finally {
      this.isLoading = false;
    }
  }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }
}