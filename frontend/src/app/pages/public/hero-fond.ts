import { Component, ElementRef, HostListener, inject } from '@angular/core';

/**
 * Fond animé de la vitrine : la photo dort dans le noir,
 * et la souris l'éclaire comme une lampe torche.
 */
@Component({
    selector: 'app-hero-fond',
    standalone: true,
    template: `
    <div class="photo sombre"></div>
    <div class="photo lumiere"></div>
    <div class="halo"></div>
    <div class="voile"></div>
  `,
    styles: [`
    @property --x { syntax: '<percentage>'; inherits: true; initial-value: 72%; }
    @property --y { syntax: '<percentage>'; inherits: true; initial-value: 45%; }

    :host {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
      --x: 72%;
      --y: 45%;
      transition: --x .5s ease-out, --y .5s ease-out;
    }

    /* Les deux couches utilisent la même photo */
    .photo {
      position: absolute;
      inset: -4%;
      background: url('/images/location-vente.jpg') center / cover no-repeat;
      animation: respire 26s ease-in-out infinite alternate;
    }

    /* Couche 1 : la pièce "dans la nuit", teintée bleu néon */
        .sombre {
      filter: grayscale(.6) sepia(.4) hue-rotate(160deg) saturate(1.6) brightness(.6) blur(1.5px);
      opacity: 1;
    }

    /* Couche 2 : la pièce éclairée, visible seulement sous le faisceau */
        .lumiere {
      filter: brightness(1.1) saturate(1.15);
      -webkit-mask-image: radial-gradient(circle 380px at var(--x) var(--y), #000 0%, rgba(0,0,0,.6) 50%, transparent 100%);
              mask-image: radial-gradient(circle 380px at var(--x) var(--y), #000 0%, rgba(0,0,0,.6) 50%, transparent 100%);
    }

    /* Léger halo cyan autour du faisceau */
    .halo {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle 340px at var(--x) var(--y), rgba(0,229,255,.14), transparent 70%);
      mix-blend-mode: screen;
    }

    /* Assombrit derrière le titre + fondu vers le noir en bas */
        .voile {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 45% 30% at 50% 45%, rgb(5 7 13 / .45), transparent 75%),
        linear-gradient(to bottom,
          rgb(5 7 13 / .35) 0%,
          rgb(5 7 13 / .05) 35%,
          rgb(5 7 13 / .2) 75%,
          var(--color-noir-950, #05070d) 100%);
    }

    @keyframes respire {
      from { transform: scale(1); }
      to   { transform: scale(1.08) translate(-1%, -1%); }
    }

    /* Téléphone / tablette (pas de souris) : la lumière se promène seule */
    @keyframes balade {
      0%   { --x: 70%; --y: 45%; }
      50%  { --x: 30%; --y: 55%; }
      100% { --x: 65%; --y: 35%; }
    }
    @media (hover: none) {
      :host { animation: balade 14s ease-in-out infinite alternate; }
    }

    /* Respect des personnes qui désactivent les animations */
    @media (prefers-reduced-motion: reduce) {
      :host, .photo { animation: none; transition: none; }
    }
  `],
})
export class HeroFond {
    private el = inject<ElementRef<HTMLElement>>(ElementRef);

    @HostListener('window:mousemove', ['$event'])
    suivre(e: MouseEvent) {
        const zone = this.el.nativeElement.getBoundingClientRect();
        if (e.clientY < zone.top || e.clientY > zone.bottom) return; // souris hors du hero

        const x = ((e.clientX - zone.left) / zone.width) * 100;
        const y = ((e.clientY - zone.top) / zone.height) * 100;
        this.el.nativeElement.style.setProperty('--x', `${x}%`);
        this.el.nativeElement.style.setProperty('--y', `${y}%`);
    }
}