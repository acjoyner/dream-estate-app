import {
  ApplicationConfig,
  importProvidersFrom,
} from '@angular/core';

import { provideRouter } from '@angular/router'; // Ensure this is imported
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { getDatabase, provideDatabase } from '@angular/fire/database'; // <--- ADDED: RTDB Imports

// Firebase Imports for @angular/fire
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getStorage, provideStorage } from '@angular/fire/storage';

import { routes } from './app.routes'; // Ensure this is imported
import { FormsModule } from '@angular/forms';


// src/app/app.config.ts

// !!! WARNING: This API key is publicly exposed in client-side code. !!!
// !!! It is secured by "HTTP referrers (web sites)" restrictions in Google Cloud Console. !!!
// !!! Do NOT add server-side API keys here. !!!
const firebaseConfig = {
  apiKey: 'AIzaSyDMGIHuEotmRpahQGmC5Bq3cWaacGq4fBs',
  authDomain: 'dreamestate-app.firebaseapp.com',
  projectId: 'dreamestate-app',
  storageBucket: 'dreamestate-app.firebasestorage.app',
  messagingSenderId: '835501734921',
  appId: '1:835501734921:web:1fadd610a08e5174350cd8',
  measurementId: 'G-746Q05T09S',
};

export const appConfig: ApplicationConfig = {
   providers: [
    provideAnimations(),
    provideRouter(routes), // This provides the routing configuration
    provideHttpClient(),

    importProvidersFrom(FormsModule),

    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    provideDatabase(() => getDatabase()), 
  ],

};
