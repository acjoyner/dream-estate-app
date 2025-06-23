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
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, NgIf,
    MessageBox, NgClass
  ]
})
export class Login implements OnInit {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  message: string = '';
  messageType: string = '';
  showMessageBox: boolean = false;

  constructor(private firebaseService: Firebase) { }

  ngOnInit(): void { }

  async onLogin(): Promise<void> {
    this.isLoading = true;
    this.message = '';
    this.messageType = '';
    this.showMessageBox = false;

    try {
      // Use real Firebase login method
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
      console.error('Login error:', error);
      this.message = `Login failed: ${error.message || 'An unknown error occurred.'}`;
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