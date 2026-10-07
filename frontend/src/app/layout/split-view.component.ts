import { ChangeDetectionStrategy, Component } from '@angular/core'

/**
 * One column on a single screen: start, end, then footer. Spanned across a
 * dual-screen or foldable device, start and footer take the first segment and
 * end takes the second, so nothing sits under the hinge.
 *
 * Content goes in by attribute: `splitStart`, `splitEnd`, `splitFooter`, and
 * `splitPlaceholder` - which fills the second segment while there is no end
 * content, and is never shown on a single screen.
 *
 * Layout is CSS only, so folding or unfolding the device never re-creates the
 * panes and never throws away a half-filled form.
 */
@Component({
  selector: 'app-split-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pane start"><ng-content select="[splitStart]" /></div>
    <div class="pane end"><ng-content select="[splitEnd]" /></div>
    <div class="pane placeholder"><ng-content select="[splitPlaceholder]" /></div>
    <div class="pane footer"><ng-content select="[splitFooter]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .pane:empty,
    .placeholder {
      display: none;
    }

    @media (horizontal-viewport-segments: 2) {
      :host {
        display: grid;
        grid-template-columns:
          env(viewport-segment-width 0 0)
          calc(env(viewport-segment-left 1 0) - env(viewport-segment-right 0 0))
          env(viewport-segment-width 1 0);
        /* The first row fits the start pane; the footer row takes whatever
           height is left beside a taller end pane, so no gap opens above it. */
        grid-template-rows: auto 1fr;
        column-gap: 0;
      }
      .pane {
        min-width: 0;
        padding-inline: 24px;
      }
      .start {
        grid-column: 1;
        grid-row: 1;
      }
      .end,
      .placeholder {
        grid-column: 3;
        grid-row: 1 / span 2;
      }
      .end:empty + .placeholder:not(:empty) {
        display: block;
        color: var(--mat-sys-on-surface-variant);
      }
      .footer {
        grid-column: 1;
        grid-row: 2;
        align-self: start;
        margin-top: 32px;
      }
    }
  `,
})
export class SplitViewComponent {}
