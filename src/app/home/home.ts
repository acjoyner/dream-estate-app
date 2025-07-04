import { Component } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [MatIcon, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  currentYear: number = new Date().getFullYear();
}
