import type { Provider } from '@angular/core'
import { ErrorStateMatcher } from '@angular/material/core'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, type MatFormFieldDefaultOptions } from '@angular/material/form-field'
import { SubmittedErrorStateMatcher } from './lib/form-validation'

/**
 * App-wide Material defaults, shared by app.config.ts and the test harness so
 * tests render the same fields users see.
 */
export function provideMaterialDefaults(): Provider[] {
  return [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'outline',
        // Space for a hint or error opens only when there is one, rather than
        // being reserved under every field.
        subscriptSizing: 'dynamic',
      } satisfies MatFormFieldDefaultOptions,
    },
    // Field errors appear once a form is submitted, not while it is filled in.
    { provide: ErrorStateMatcher, useClass: SubmittedErrorStateMatcher },
  ]
}
