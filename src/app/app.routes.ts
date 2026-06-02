import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Routes = [
  {
    path: '',
    redirectTo: 'landing',
    pathMatch: 'full'
  },
  {
    path: 'landing',
    loadComponent: () => import('./pages/landing/landing.page').then((m) => m.LandingPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage)
  },
  // Vista pública de perfil (sin tabs) por si se enlaza desde fuera.
  {
    path: 'profile/:userId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage)
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage)
      },
      {
        path: 'review',
        loadComponent: () => import('./pages/review/review.page').then((m) => m.ReviewPage)
      },
      {
        path: 'review/:reviewId',
        loadComponent: () =>
          import('./pages/review-detail/review-detail.page').then((m) => m.ReviewDetailPage)
      },
      {
        path: 'games',
        loadComponent: () => import('./pages/games/games.page').then((m) => m.GamesPage)
      },
      {
        path: 'game/:id',
        loadComponent: () => import('./pages/game/game.page').then((m) => m.GamePage)
      },
      {
        path: 'social',
        loadComponent: () => import('./pages/social/social.page').then((m) => m.SocialPage)
      },
      {
        path: 'social/chat/:conversationId',
        loadComponent: () =>
          import('./pages/chat-detail/chat-detail.page').then((m) => m.ChatDetailPage)
      },
      {
        path: 'feed',
        loadComponent: () => import('./pages/feed/feed.page').then((m) => m.FeedPage)
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users.page').then((m) => m.UsersPage)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage)
      },
      {
        path: 'profile/:userId',
        loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  }
];
