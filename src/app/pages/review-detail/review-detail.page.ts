import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';

import { ReviewItem, ReviewStats } from '../../models';
import { SocialService } from '../../core/services/social.service';
import { ReviewStatsCardComponent } from '../../shared/components/review-stats-card/review-stats-card.component';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, IonButton, IonContent, IonSpinner, IonText, ReviewStatsCardComponent],
  styleUrls: ['./review-detail.page.scss'],
  template: `
    <ion-content>
      <div class="page-shell page">
        <ion-button fill="clear" routerLink="/tabs/review">Volver a reviews</ion-button>

        <section class="surface-card detail-card" *ngIf="review() as r">
          <p class="eyebrow">Review</p>
          <header>
            <div>
              <h1>{{ r.title }}</h1>
            </div>
            <span>{{ r.rating }}/10</span>
          </header>

          <div class="game-line">
            <strong>{{ r.game }}</strong>
            <small>{{ r.author }} - {{ r.createdAt }}</small>
          </div>

          <p class="comment">{{ r.comment }}</p>
        </section>

        <app-review-stats-card
          *ngIf="stats() as s"
          [stats]="s"
          title="Distribución del juego">
        </app-review-stats-card>

        <div class="loading" *ngIf="loading()">
          <ion-spinner name="crescent"></ion-spinner>
        </div>

        <ion-text color="danger" *ngIf="error()">
          <p>{{ error() }}</p>
        </ion-text>
      </div>
    </ion-content>
  `
})
export class ReviewDetailPage implements OnInit {
  readonly review = signal<ReviewItem | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly stats = signal<ReviewStats | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly social: SocialService
  ) {}

  async ngOnInit(): Promise<void> {
    const reviewId = this.route.snapshot.paramMap.get('reviewId');
    if (!reviewId) {
      this.error.set('Review no encontrada.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      const review = await this.social.getReviewById(reviewId);
      this.review.set(review);
      if (review?.gameId) {
        try {
          this.stats.set(await this.social.getReviewStats(review.gameId));
        } catch {
          this.stats.set(null);
        }
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar la review.');
    } finally {
      this.loading.set(false);
    }
  }
}
