import { ChangeDetectionStrategy, Component, ViewEncapsulation, signal } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { ThemeToggleComponent } from '../theme/theme-toggle.component'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/status', label: 'Status' },
]

// Past this many pixels of movement a scroll counts; below it, trackpad
// jitter would flap the header.
const SCROLL_THRESHOLD = 8
const HEADER_HEIGHT = 64

/**
 * Unencapsulated, because the dual-screen rules below reach the `main` of
 * whichever page is projected in - and those elements belong to the page.
 * Everything is scoped under `.app-shell` instead.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, RouterLinkActive, ThemeToggleComponent],
  host: {
    class: 'app-shell',
    '(window:scroll)': 'onScroll()',
  },
  template: `
    <header class="app-header" [class.app-header-hidden]="hidden()">
      <div class="app-shell-container">
        <div class="app-header-bar">
          <a class="app-brand" routerLink="/">TeamFlow</a>
          <nav aria-label="Primary" class="flex items-center gap-4">
            @for (item of navItems; track item.to) {
              <a class="app-nav-item" [routerLink]="item.to" routerLinkActive="active" ariaCurrentWhenActive="page">{{
                item.label
              }}</a>
            }
          </nav>
          <app-theme-toggle />
        </div>
      </div>
    </header>
    <div class="app-shell-container app-shell-content">
      <ng-content />
    </div>
  `,
  styles: `
    .app-shell {
      display: block;
      min-height: 100dvh;
    }

    .app-header {
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      background-color: color-mix(in srgb, var(--mat-sys-surface) 80%, transparent);
      transition: transform 0.25s ease;
    }

    .app-header.app-header-hidden {
      transform: translateY(-100%);
    }

    .app-shell-container {
      width: 100%;
      max-width: 900px;
      margin-inline: auto;
      padding-inline: 16px;
    }

    .app-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-block: 8px;
    }

    .app-shell-content {
      padding-block: 24px;
    }

    @media (min-width: 600px) {
      .app-shell-container {
        padding-inline: 24px;
      }
      .app-header-bar {
        padding-block: 12px;
      }
      .app-shell-content {
        padding-block: 40px;
      }
    }

    .app-brand {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      text-decoration: none;
    }

    .app-brand:hover {
      color: var(--mat-sys-primary);
    }

    .app-nav-item {
      color: var(--mat-sys-on-surface-variant);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      padding-block: 4px;
      border-bottom: 2px solid transparent;
    }

    .app-nav-item:hover {
      color: var(--mat-sys-on-surface);
    }

    .app-nav-item.active {
      color: var(--mat-sys-primary);
      border-bottom-color: var(--mat-sys-primary);
    }

    /* Dual-screen and unfolded foldable devices spanning the page across both
       segments, with the hinge as a vertical strip between them. The env()
       values come from the Viewport Segments API; browsers without it never
       match the query. A page stays on the first segment unless it lays itself
       out across both with app-split-view; the nav never straddles the hinge. */
    @media (horizontal-viewport-segments: 2) {
      .app-shell-container {
        max-width: none;
        padding-inline: 0;
      }
      .app-header-bar,
      .app-shell-content main {
        width: env(viewport-segment-width 0 0);
        padding-inline: 24px;
      }
      .app-shell-content main:has(> app-split-view) {
        width: auto;
        padding-inline: 0;
      }
    }
  `,
})
export class AppShellComponent {
  protected readonly navItems = NAV_ITEMS
  protected readonly hidden = signal(false)
  private lastY = window.scrollY

  // Hides the header once the page has scrolled past it and the user is
  // scrolling down.
  protected onScroll() {
    const y = window.scrollY
    const delta = y - this.lastY
    if (Math.abs(delta) > SCROLL_THRESHOLD) {
      this.hidden.set(delta > 0 && y > HEADER_HEIGHT)
      this.lastY = y
    }
  }
}
