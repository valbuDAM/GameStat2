import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, Input, computed, signal } from '@angular/core';

import { ReviewStats } from '../../../models';

/**
 * Card que muestra la distribución 1-10 de reseñas y la media,
 * en formato barra horizontal con porcentajes.
 *
 * Uso:
 *   <app-review-stats-card [stats]="stats()"></app-review-stats-card>
 */
@Component({
  selector: 'app-review-stats-card',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  styles: [`
    :host { display: block; }
    .stats-card {
      background: var(--app-surface, rgba(27, 24, 46, 0.72));
      border-radius: 16px;
      padding: 16px;
      border: 1px solid var(--app-border, rgba(196,181,253,.14));
    }
    .head {
      display: flex; justify-content: space-between; align-items: baseline;
      gap: 12px; margin-bottom: 12px;
    }
    .head h3 { margin: 0; font-size: 15px; color: var(--app-text, #f6f3ff); }
    .avg {
      display: flex; flex-direction: column; align-items: flex-end;
      font-variant-numeric: tabular-nums;
    }
    .avg strong { font-size: 22px; color: var(--app-primary, #a78bfa); line-height: 1; }
    .avg small { color: var(--app-text-soft, #c9c0df); font-size: 12px; }
    .bars { display: flex; flex-direction: column; gap: 6px; }
    .row { display: grid; grid-template-columns: 24px 1fr 40px; gap: 8px; align-items: center; }
    .label { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--app-text-soft, #c9c0df); }
    .track {
      background: rgba(196,181,253,0.08); height: 8px; border-radius: 8px; overflow: hidden;
    }
    .fill {
      background: linear-gradient(90deg, var(--app-primary, #a78bfa), #ec4899);
      height: 100%; border-radius: 8px;
      transition: width 0.4s cubic-bezier(.22,1,.36,1);
    }
    .count { font-size: 11px; color: var(--app-text-soft, #c9c0df); text-align: right; }
    .empty { color: var(--app-text-soft, #c9c0df); font-size: 13px; text-align: center; padding: 12px 0; }
  `],
  template: `
    <div class="stats-card" role="group" aria-label="Distribución de reseñas">
      <header class="head">
        <h3>{{ title }}</h3>
        <span class="avg" *ngIf="(stats?.totalCount || 0) > 0; else emptyAvg">
          <strong>{{ stats?.avgRating || 0 | number: '1.1-1' }}</strong>
          <small>{{ stats?.totalCount }} reseñas</small>
        </span>
        <ng-template #emptyAvg>
          <span class="avg"><strong>—</strong><small>Sin reseñas</small></span>
        </ng-template>
      </header>

      <div class="bars" *ngIf="(stats?.totalCount || 0) > 0; else noStats">
        <div class="row" *ngFor="let r of rows()">
          <span class="label">{{ r.rating }}</span>
          <span class="track">
            <span class="fill" [style.width.%]="r.percent"></span>
          </span>
          <span class="count">{{ r.count }}</span>
        </div>
      </div>
      <ng-template #noStats>
        <p class="empty">Aún no hay reseñas para mostrar.</p>
      </ng-template>
    </div>
  `
})
export class ReviewStatsCardComponent {
  @Input() title = 'Distribución de puntuaciones';
  private readonly statsSig = signal<ReviewStats | null>(null);

  @Input() set stats(value: ReviewStats | null | undefined) {
    this.statsSig.set(value ?? null);
  }
  get stats(): ReviewStats | null {
    return this.statsSig();
  }

  readonly rows = computed(() => {
    const s = this.statsSig();
    if (!s || s.totalCount === 0) return [];
    const max = Math.max(...s.distribution, 1);
    return Array.from({ length: 10 }, (_, i) => {
      const rating = 10 - i;
      const count = s.distribution[rating - 1] ?? 0;
      const percent = Math.round((count / max) * 100);
      return { rating, count, percent };
    });
  });
}
