import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Firebase } from '../services/firebase';
import { map, take } from 'rxjs/operators';

export const adminGuard: CanActivateFn = (route, state) => {
  const firebaseService = inject(Firebase);
  const router = inject(Router);

  return firebaseService.isAdmin$.pipe(
    map(isAdmin => {
      if (isAdmin) {
        return true; // User is admin, allow access
      } else {
        router.navigate(['/display']); // User is not admin, redirect to main app view
        alert('Access Denied: You must be an administrator to view this page.'); // Inform user
        return false;
      }
    }),
    take(1)
  );
};