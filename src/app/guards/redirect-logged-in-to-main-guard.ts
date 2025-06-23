import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Firebase } from '../services/firebase';
import { map, take } from 'rxjs/operators';

export const redirectLoggedInToMainGuard: CanActivateFn = (route, state) => {
  const firebaseService = inject(Firebase);
  const router = inject(Router);

  return firebaseService.userId$.pipe(
    map(userId => {
      if (userId) {
        router.navigate(['/display']); // User is logged in, redirect to main app view
        return false; // Prevent access to login/signup
      } else {
        return true; // User is logged out, allow access to login/signup
      }
    }),
    take(1)
  );
};