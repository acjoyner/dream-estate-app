import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { NgIf } from '@angular/common';


@Component({
  selector: 'app-message-box',
  imports: [MatCardModule, MatButtonModule, NgIf],
  templateUrl: './message-box.html',
  styleUrl: './message-box.scss',
})
export class MessageBox {
  @Input() message: string = '';
  @Output() onClose = new EventEmitter<void>();

  constructor() {}

  close(): void {
    this.onClose.emit();
  }
}
