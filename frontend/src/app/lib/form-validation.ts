import type { AbstractControl, FormGroup, FormGroupDirective, NgForm, ValidationErrors, ValidatorFn } from '@angular/forms'
import type { ErrorStateMatcher } from '@angular/material/core'

/** Error key → message, for the errors a field's validators can produce. */
export type ErrorMessages = Partial<Record<string, string>>

/**
 * Runs every control's validators and returns the form's value when it is
 * valid, or `null` after marking the controls touched so their errors show.
 *
 * Validators are re-run first because some read a sibling control (a
 * confirmation field, a conditionally required one) and would otherwise still
 * reflect the sibling's value from the last time *they* changed.
 */
export function submitForm<F extends FormGroup>(form: F): ReturnType<F['getRawValue']> | null {
  for (const control of Object.values(form.controls)) control.updateValueAndValidity({ emitEvent: false })
  form.markAllAsTouched()
  return form.valid ? (form.getRawValue() as ReturnType<F['getRawValue']>) : null
}

/** The message for the first error on `control` that `messages` describes. */
export function errorMessage(control: AbstractControl, messages: ErrorMessages): string | undefined {
  const errors = control.errors
  if (!errors) return undefined
  const key = Object.keys(errors).find((name) => messages[name] !== undefined)
  return key === undefined ? undefined : messages[key]
}

/**
 * Shows a field's error only once its form has been submitted - nothing is
 * flagged while the user is still filling the form in, which is how the forms
 * have always behaved. Requiring `touched` as well hides errors again after a
 * successful submit resets the form, even though the form stays "submitted".
 */
export class SubmittedErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: AbstractControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control?.invalid && control.touched && form?.submitted)
  }
}

/** Like `Validators.required`, but whitespace alone does not count. Error key: `blank`. */
export const notBlank: ValidatorFn = (control): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim() === '' ? { blank: true } : null

/** The value must equal the sibling control `name`'s. Error key: `mismatch`. */
export function matchesControl(name: string): ValidatorFn {
  return (control) => {
    const other = control.parent?.get(name)
    return other && control.value !== other.value ? { mismatch: true } : null
  }
}

/**
 * Required only while `condition(control)` holds. Error key: `required`.
 * The condition gets the control so it can read siblings through
 * `control.parent`, which is unset while the form is still being built.
 */
export function requiredWhen(condition: (control: AbstractControl) => boolean): ValidatorFn {
  return (control) => (condition(control) && !control.value ? { required: true } : null)
}
