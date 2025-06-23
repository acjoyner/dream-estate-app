import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Firebase } from '../services/firebase';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const firebaseService = inject(Firebase);
  const router = inject(Router);

  return firebaseService.userId$.pipe(
    map(userId => {
      if (userId) {
        return true; // User is logged in, allow access
      } else {
        router.navigate(['/login']); // User is not logged in, redirect to login
        return false;
      }
    }),
    take(1) // Ensure the observable completes after the first value
  );
};