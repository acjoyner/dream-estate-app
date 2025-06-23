import {
  ApplicationConfig,
  importProvidersFrom, // Keep this for FormsModule
} from '@angular/core';

import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';

// Firebase Imports for @angular/fire
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getStorage, provideStorage } from '@angular/fire/storage';

import { routes } from './app.routes';
import { FormsModule } from '@angular/forms'; // FormsModule is an NgModule
import { MatListModule } from '@angular/material/list';

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
    // Core Angular Providers (directly added to providers array)
    provideAnimations(),
    provideRouter(routes),
    provideHttpClient(),
    MatListModule, // <-- Add MatListModule here

    // NgModules that need their providers imported into the standalone app
    // FormsModule is an NgModule, so it uses importProvidersFrom
    importProvidersFrom(FormsModule), // Correct usage for NgModule

    // Firebase Providers from @angular/fire
    // These functions themselves return EnvironmentProviders, so they are added directly
    // to the providers array, WITHOUT importProvidersFrom.
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),

    // IMPORTANT: Angular Material modules like MatToolbarModule, MatButtonModule, etc.
    // are imported DIRECTLY into the `imports` array of each STANDALONE COMPONENT
    // that uses them (e.g., AppComponent, Login, MediaUpload, MediaDisplay, Profile, MessageBox).
    // They should NOT be listed here in app.config.ts as global providers.
  ],
};
