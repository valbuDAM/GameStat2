import { Animation, AnimationController, createAnimation } from '@ionic/angular';

/**
 * Animacion nativa Ionic personalizada de transicion entre paginas.
 * - Forward: la pagina entrante se desliza desde la derecha + fade.
 * - Back:    la pagina saliente se desliza a la derecha + fade.
 * Se aplica globalmente via provideIonicAngular({ navAnimation }).
 *
 * Usa la API oficial `AnimationController` -> ejecucion nativa con
 * requestAnimationFrame + Web Animations API (no JS de cada frame).
 */
export function pageTransitionAnimation(
  baseEl: HTMLElement,
  opts: { enteringEl: HTMLElement; leavingEl?: HTMLElement; direction?: 'forward' | 'back' }
): Animation {
  const DURATION = 260;
  const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const isBack = opts.direction === 'back';

  const root = createAnimation()
    .duration(DURATION)
    .easing(EASE);

  if (opts.enteringEl) {
    const entering = createAnimation()
      .addElement(opts.enteringEl)
      .beforeStyles({ 'will-change': 'transform, opacity' })
      .fromTo('opacity', 0, 1)
      .fromTo(
        'transform',
        isBack ? 'translateX(-22px)' : 'translateX(22px)',
        'translateX(0)'
      );
    root.addAnimation(entering);
  }

  if (opts.leavingEl) {
    const leaving = createAnimation()
      .addElement(opts.leavingEl)
      .beforeStyles({ 'will-change': 'transform, opacity' })
      .fromTo('opacity', 1, 0)
      .fromTo(
        'transform',
        'translateX(0)',
        isBack ? 'translateX(22px)' : 'translateX(-22px)'
      );
    root.addAnimation(leaving);
  }

  return root;
}

/**
 * Helper para usar fuera del router (por ejemplo en aparicion/desaparicion
 * de cards en el feed). Devuelve una animacion ya configurada.
 */
export function fadeInUp(ac: AnimationController, el: HTMLElement, delayMs = 0): Animation {
  return ac.create()
    .addElement(el)
    .duration(280)
    .delay(delayMs)
    .easing('cubic-bezier(0.22, 1, 0.36, 1)')
    .fromTo('opacity', 0, 1)
    .fromTo('transform', 'translateY(8px)', 'translateY(0)');
}
