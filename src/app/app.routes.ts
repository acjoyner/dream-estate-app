import { Routes } from '@angular/router';

import { Login } from './auth/login/login';
import { Signup } from './auth/signup/signup';
import { MediaUpload } from './media-upload/media-upload';
import { MediaDisplay } from './media-display/media-display';
import { Profile } from './profile/profile';
import { Friends } from './friends/friends';
import { HelpfulLinks } from './helpful-links/helpful-links';
import { AdminPanel } from './admin-panel/admin-panel';
import { NotFound } from './not-found/not-found'; // New: Import NotFound component

import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';
import { redirectLoggedInToMainGuard } from './guards/redirect-logged-in-to-main-guard';

export const routes: Routes = [
  // Public routes accessible to anyone (even logged out)
  { path: 'login', component: Login, canActivate: [redirectLoggedInToMainGuard] },
  { path: 'signup', component: Signup, canActivate: [redirectLoggedInToMainGuard] },
  { path: 'resources', component: HelpfulLinks },

  // Protected routes (require user to be logged in)
  { path: 'upload', component: MediaUpload, canActivate: [authGuard] },
  { path: 'display', component: MediaDisplay, canActivate: [authGuard] },
  { path: 'profile', component: Profile, canActivate: [authGuard] },
  { path: 'friends', component: Friends, canActivate: [authGuard] },

  // Admin-only route (requires user to be logged in AND have 'admin' role)
  { path: 'admin', component: AdminPanel, canActivate: [authGuard, adminGuard] },

  // Default redirect for root path (''):
  { path: '', redirectTo: 'display', pathMatch: 'full' },

  // Not Found / Wildcard Route:
  // This MUST be the last route in the configuration.
  // Any unmatched URL will redirect to '/404'.
  { path: '404', component: NotFound }, // New: Route for the Not Found page
  { path: '**', redirectTo: '404', pathMatch: 'full' } // FIX: Wildcard redirects to /404
];