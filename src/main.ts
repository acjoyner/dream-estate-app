import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

import '@angular/fire/app'; // Import Firebase App module

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
