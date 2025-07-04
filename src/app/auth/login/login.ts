import { Component, OnInit } from '@angular/core';
import { Firebase } from '../../services/firebase';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { NgIf, NgClass } from '@angular/common';
import { MessageBox } from '../../shared/message-box/message-box';
// Removed MatIconModule as it's only for Apple logo now
// import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, NgIf, NgClass,
    MessageBox
    // Removed MatIconModule from imports
  ]
})
export class Login implements OnInit {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  message: string = '';
  messageType: string = '';
  showMessageBox: boolean = false;
  // Removed socialLoginStatus as social login methods are removed
  // socialLoginStatus: string = '';

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void { }

  async onLogin(): Promise<void> {
    this.isLoading = true;
    this.message = '';
    // this.socialLoginStatus = ''; // Removed
    this.showMessageBox = false;

    if (!this.email || !this.password) {
        this.message = 'Please enter both email and password.';
        this.messageType = 'error';
        this.showMessageBox = true;
        this.isLoading = false;
        return;
    }

    try {
      const success = await this.firebaseService.login(this.email, this.password).toPromise();
      if (success) {
        this.message = 'Login successful!';
        this.messageType = 'success';
      } else {
        this.message = 'Login failed: Invalid email or password.';
        this.messageType = 'error';
        this.showMessageBox = true;
      }
    } catch (error: any) {
      console.error('Login error (Email/Pass):', error);
      let errorMessage = 'Login failed.';
      if (error.code) {
        switch (error.code) {
          case 'auth/invalid-email': errorMessage = 'Invalid email address format.'; break;
          case 'auth/user-not-found': errorMessage = 'User not found. Please sign up.'; break;
          case 'auth/wrong-password': errorMessage = 'Invalid password.'; break;
          case 'auth/user-disabled': errorMessage = 'This user account has been disabled.'; break;
          default: errorMessage = `Login failed: ${error.message}`;
        }
      }
      this.message = errorMessage;
      this.messageType = 'error';
      this.showMessageBox = true;
    } finally {
      this.isLoading = false;
    }
  }

  // Removed onGoogleLogin and onAppleLogin methods
  // async onGoogleLogin(): Promise<void> { ... }
  // async onAppleLogin(): Promise<void> { ... }

  closeMessageBox(): void {
    this.showMessageBox = false;
  }
}