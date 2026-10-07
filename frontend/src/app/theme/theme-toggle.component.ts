import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { MatIconButton } from '@angular/material/button'
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { IconComponent, type IconName } from '../components/icon.component'
import { ThemeService, type ThemePreference } from './theme.service'

const OPTIONS: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: 'light', label: 'Light', icon: 'light-mode' },
  { value: 'dark', label: 'Dark', icon: 'dark-mode' },
  { value: 'system', label: 'System', icon: 'computer' },
]

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, MatIconButton, MatMenu, MatMenuItem, MatMenuTrigger],
  template: `
    <button matIconButton type="button" aria-label="Change theme" [matMenuTriggerFor]="menu">
      <app-icon [name]="theme.appearance() === 'dark' ? 'dark-mode' : 'light-mode'" />
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      @for (option of options; track option.value) {
        <button
          mat-menu-item
          type="button"
          [class.mat-mdc-menu-item-highlighted]="theme.preference() === option.value"
          (click)="theme.setPreference(option.value)"
        >
          <span class="flex items-center gap-3">
            <app-icon [name]="option.icon" />
            <span class="flex-1">{{ option.label }}</span>
            @if (theme.preference() === option.value) {
              <app-icon name="check" class="ms-2" />
            }
          </span>
        </button>
      }
    </mat-menu>
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService)
  protected readonly options = OPTIONS
}
