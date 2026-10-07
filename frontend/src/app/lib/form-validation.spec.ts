import { FormControl, FormGroup, Validators } from '@angular/forms'
import { describe, expect, it } from 'vitest'
import { SubmittedErrorStateMatcher, errorMessage, matchesControl, notBlank, requiredWhen, submitForm } from './form-validation'

function buildForm(values: { email: string; password: string; confirm: string }) {
  return new FormGroup({
    email: new FormControl(values.email, { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl(values.password, { nonNullable: true, validators: Validators.minLength(8) }),
    confirm: new FormControl(values.confirm, { nonNullable: true, validators: matchesControl('password') }),
  })
}

const EMAIL_MESSAGES = { required: 'Email is required', email: 'Enter a valid email address' }

describe('submitForm', () => {
  it('returns the value when the form is valid', () => {
    const form = buildForm({ email: 'ada@example.com', password: 'password123', confirm: 'password123' })

    expect(submitForm(form)).toEqual({ email: 'ada@example.com', password: 'password123', confirm: 'password123' })
  })

  it('returns null and marks every control touched when invalid', () => {
    const form = buildForm({ email: '', password: 'short', confirm: 'short' })

    expect(submitForm(form)).toBeNull()
    expect(form.controls.email.touched).toBe(true)
    expect(form.controls.password.touched).toBe(true)
  })

  // The confirmation only re-validates when it changes itself, so a later
  // edit to the password would otherwise go unnoticed until then.
  it('re-checks a field that depends on a sibling before deciding', () => {
    const form = buildForm({ email: 'ada@example.com', password: 'password123', confirm: 'password123' })
    form.controls.password.setValue('different-pass')

    expect(submitForm(form)).toBeNull()
    expect(form.controls.confirm.hasError('mismatch')).toBe(true)
  })
})

describe('errorMessage', () => {
  it('describes the first error the messages cover', () => {
    const form = buildForm({ email: '', password: 'password123', confirm: 'password123' })
    expect(errorMessage(form.controls.email, EMAIL_MESSAGES)).toBe('Email is required')

    form.controls.email.setValue('not-an-email')
    expect(errorMessage(form.controls.email, EMAIL_MESSAGES)).toBe('Enter a valid email address')
  })

  it('is undefined for a valid control', () => {
    const form = buildForm({ email: 'ada@example.com', password: 'password123', confirm: 'password123' })

    expect(errorMessage(form.controls.email, EMAIL_MESSAGES)).toBeUndefined()
  })
})

describe('validators', () => {
  it('notBlank rejects whitespace-only values', () => {
    expect(notBlank(new FormControl('   '))).toEqual({ blank: true })
    expect(notBlank(new FormControl(' Ada '))).toBeNull()
  })

  it('requiredWhen only applies while its condition holds', () => {
    let applies = false
    const validator = requiredWhen(() => applies)

    expect(validator(new FormControl(''))).toBeNull()
    applies = true
    expect(validator(new FormControl(''))).toEqual({ required: true })
    expect(validator(new FormControl('secret'))).toBeNull()
  })
})

describe('SubmittedErrorStateMatcher', () => {
  const matcher = new SubmittedErrorStateMatcher()
  const invalidTouched = () => {
    const control = new FormControl('', Validators.required)
    control.markAsTouched()
    return control
  }

  it('hides errors until the form is submitted', () => {
    expect(matcher.isErrorState(invalidTouched(), { submitted: false } as never)).toBe(false)
    expect(matcher.isErrorState(invalidTouched(), { submitted: true } as never)).toBe(true)
  })

  it('hides errors on a control reset after a successful submit', () => {
    expect(matcher.isErrorState(new FormControl('', Validators.required), { submitted: true } as never)).toBe(false)
  })
})
