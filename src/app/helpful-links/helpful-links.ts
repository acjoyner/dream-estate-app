import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, NgIf } from '@angular/common'; // Required for *ngFor and *ngIf

interface ResourceLink {
  name: string;
  url: string;
  description: string;
  icon: string; // Material icon name
}

@Component({
  selector: 'app-helpful-links',
  templateUrl: './helpful-links.html',
  styleUrls: ['./helpful-links.scss'],
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    NgFor, // Import NgFor
    NgIf // Import NgIf
  ]
})
export class HelpfulLinks {
  // Define the array of resource links
  resources: ResourceLink[] = [
    {
      name: 'NCREC (NC Real Estate Commission)',
      url: 'https://www.ncrec.gov/',
      description: 'Official website for the North Carolina Real Estate Commission, regulating brokers and salespersons.',
      icon: 'gavel' // or 'info', 'policy'
    },
    {
      name: 'National Association of REALTORS® (NAR)',
      url: 'https://www.nar.realtor/',
      description: 'The largest trade association in the United States, representing over 1.5 million members involved in all aspects of the residential and commercial real estate industries.',
      icon: 'home' // or 'group'
    },
    {
      name: 'Council of Multiple Listing Services (CMLS)',
      url: 'https://www.cmls.org/',
      description: 'A professional trade organization that serves to advance the MLS industry in North America. Provides information on MLS standards and operations.',
      icon: 'list_alt' // or 'storage', 'data_usage'
    },
    // You can add more links here as needed
    // {
    //   name: 'NC Housing Finance Agency',
    //   url: 'https://www.nchfa.com/',
    //   description: 'Offers financing and programs for affordable housing in North Carolina.',
    //   icon: 'house_siding'
    // }
  ];

  constructor() { }

  openLink(url: string): void {
    window.open(url, '_blank'); // Open link in a new tab
  }
}