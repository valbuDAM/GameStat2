import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';

import { SocialService } from '../../core/services/social.service';
import { RatingStarsComponent } from '../../shared';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, IonButton, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, RatingStarsComponent],
  styleUrls: ['./landing.page.scss'],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-title>GameStat</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="page-shell landing">
        <section class="hero surface-card">
          <div class="hero-copy">
            <p class="eyebrow">Guarda, valora y comparte juegos</p>
            <h1>GameStat convierte tu biblioteca gamer en una experiencia social clara y sencilla.</h1>
            <p>
              Descubre juegos, guarda tus favoritos con un corazoncito, escribe reviews y sigue
              la actividad de tu comunidad desde una sola app.
            </p>

            <div class="actions">
              <ion-button routerLink="/login" class="cta-primary">Iniciar sesion</ion-button>
              <ion-button routerLink="/register" fill="outline" class="cta-outline">Crear cuenta</ion-button>
            </div>

            <div class="hero-metrics">
              <div>
                <strong>Favoritos</strong>
                <span>Guarda juegos para verlos despues</span>
              </div>
              <div>
                <strong>Reviews</strong>
                <span>Valora cada juego con contexto</span>
              </div>
              <div>
                <strong>Comunidad</strong>
                <span>Comparte, comenta y chatea</span>
              </div>
            </div>
          </div>

          <div class="hero-panel surface-card">
            <div class="panel-header">
              <p class="eyebrow">Como funciona</p>
              <h2>Todo en tres pasos</h2>
            </div>
            <div class="step-list">
              <article>
                <span>01</span>
                <div>
                  <h3>Explora</h3>
                  <p>Busca juegos y revisa su ficha, rating y fecha de lanzamiento.</p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <h3>Guarda</h3>
                  <p>Marca favoritos con el corazoncito para no perderlos de vista.</p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <h3>Comparte</h3>
                  <p>Publica reviews, entra al feed y habla con otros jugadores.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="card-grid feature-grid">
          <article class="surface-card feature">
            <h2>Catalogo</h2>
            <p>Busca por nombre, abre fichas y navega por juegos populares o nuevos resultados.</p>
          </article>
          <article class="surface-card feature">
            <h2>Perfil</h2>
            <p>Tu nombre, tu bio, tu juego favorito y tu lista de juegos guardados.</p>
          </article>
          <article class="surface-card feature">
            <h2>Social</h2>
            <p>Feed, mensajes y comunidad para hablar de lo que juegas sin salir de la app.</p>
          </article>
        </section>

        <section class="surface-card testimonial" *ngIf="featuredReview() as review; else noReviews">
          <div class="testimonial-head">
            <p class="eyebrow">Opinion real</p>
            <h2>Lo ultimo que se comenta</h2>
          </div>
          <div class="testimonial-body">
            <div class="review-meta">
              <strong>{{ review.game }}</strong>
              <app-rating-stars [value]="review.rating" [max]="10" [readonly]="true" [showValue]="true" [size]="16">
              </app-rating-stars>
            </div>
            <p class="quote">"{{ review.comment }}"</p>
            <span class="author">{{ review.author }} · {{ review.createdAt }}</span>
          </div>
        </section>

        <ng-template #noReviews>
          <section class="surface-card testimonial empty">
            <p class="eyebrow">Opinion real</p>
            <h2>Aun no hay reviews publicadas</h2>
            <p>Cuando la comunidad publique nuevas opiniones, apareceran aqui.</p>
          </section>
        </ng-template>
      </div>
    </ion-content>
  `
})
export class LandingPage {
  private readonly social = inject(SocialService);

  readonly featuredReview = computed(() => this.social.reviews()[0] ?? null);
}
