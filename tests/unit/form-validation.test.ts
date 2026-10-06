import { describe, it, expect } from 'vitest'
import type { ZodType } from 'zod'
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validations/auth'
import { createLocationSchema, updateLocationSchema } from '@/lib/validations/location'
import { profileSchema, changePasswordSchema } from '@/lib/validations/settings'
import { inviteMemberSchema, updateMemberSchema, resendInviteSchema } from '@/lib/validations/team'
import { publicPgaFormSchema } from '@/lib/validations/pga'

/** field path -> messages, in the order the schema reports them. */
function errors(schema: ZodType, input: unknown): Record<string, string[]> {
  const result = schema.safeParse(input)
  if (result.success) return {}
  const out: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_'
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

// Seed data and some production rows use hand-written ids that are not
// RFC 4122 v1-v8 (e.g. fobs c0000000-...). They must still be accepted.
const FOB = 'c0000000-0000-0000-0000-000000000001'
const LOCATION = 'a0000000-0000-0000-0000-000000000001'
const ROLE = '50a04d2d-9e1d-42d9-b0e8-71f263a6144b'
const GOOD_PASSWORD = 'Abcdef1!'

describe('auth schemas', () => {
  it('login: email and password messages', () => {
    expect(errors(loginSchema, { email: 'nope', password: '' })).toEqual({
      email: ['Please enter a valid email address'],
      password: ['Password is required'],
    })
    expect(errors(loginSchema, { email: 'a.b+c@example.co.uk', password: 'x' })).toEqual({})
  })

  it('email format: accepts and rejects the same addresses as before', () => {
    for (const ok of ['user@example.com', "o'brien@example.org", 'first.last@sub.example.ug']) {
      expect(errors(forgotPasswordSchema, { email: ok }), ok).toEqual({})
    }
    for (const bad of ['', 'user@', '@example.com', 'user@example', 'a..b@example.com', '.a@example.com']) {
      expect(errors(forgotPasswordSchema, { email: bad }), bad).toEqual({
        email: ['Please enter a valid email address'],
      })
    }
  })

  it('password rules report every failing requirement in order', () => {
    expect(
      errors(resetPasswordSchema, { password: 'abc', confirmPassword: 'abc' }).password
    ).toEqual([
      'Password must be at least 8 characters',
      'Password must contain at least one uppercase letter',
      'Password must contain at least one number',
      'Password must contain at least one special character',
    ])
  })

  it("mismatched confirmation shows Passwords don't match", () => {
    expect(
      errors(resetPasswordSchema, { password: GOOD_PASSWORD, confirmPassword: 'Abcdef1?' })
    ).toEqual({ confirmPassword: ["Passwords don't match"] })
  })

  it('signup: FOB/location selection and non-RFC ids', () => {
    const base = {
      email: 'new@example.com',
      password: GOOD_PASSWORD,
      confirmPassword: GOOD_PASSWORD,
    }
    expect(errors(signupSchema, { ...base, fobId: FOB, locationId: LOCATION })).toEqual({})
    expect(errors(signupSchema, { ...base, fobId: '', locationId: 'x' })).toEqual({
      fobId: ['Please select a FOB'],
      locationId: ['Please select a location'],
    })
  })
})

describe('location schemas', () => {
  it('name and FOB messages', () => {
    for (const schema of [createLocationSchema, updateLocationSchema]) {
      expect(errors(schema, { name: '', fobId: '' })).toEqual({
        name: ['Location name is required'],
        fobId: ['Please select a FOB'],
      })
      expect(errors(schema, { name: 'Kampala', fobId: FOB, pastor: null })).toEqual({})
    }
  })
})

describe('settings schemas', () => {
  it('profile email message', () => {
    expect(errors(profileSchema, { email: 'x' })).toEqual({
      email: ['Please enter a valid email address'],
    })
  })

  it('change password messages', () => {
    expect(
      errors(changePasswordSchema, {
        currentPassword: '',
        newPassword: GOOD_PASSWORD,
        confirmPassword: GOOD_PASSWORD,
      })
    ).toEqual({ currentPassword: ['Current password is required'] })
    expect(
      errors(changePasswordSchema, {
        currentPassword: GOOD_PASSWORD,
        newPassword: GOOD_PASSWORD,
        confirmPassword: GOOD_PASSWORD,
      })
    ).toEqual({ newPassword: ['New password must be different from current password'] })
    expect(
      errors(changePasswordSchema, {
        currentPassword: 'Old1234!',
        newPassword: GOOD_PASSWORD,
        confirmPassword: 'other',
      })
    ).toEqual({ confirmPassword: ["Passwords don't match"] })
  })
})

describe('team schemas', () => {
  it('invite / update / resend messages', () => {
    expect(errors(inviteMemberSchema, { email: 'bad', roleId: '' })).toEqual({
      email: ['Please enter a valid email address'],
      roleId: ['Please select a role'],
    })
    expect(
      errors(inviteMemberSchema, { email: 'p@example.com', roleId: ROLE, fobId: FOB, locationId: null })
    ).toEqual({})
    expect(errors(updateMemberSchema, { roleId: 'nope' })).toEqual({ roleId: ['Please select a role'] })
    expect(errors(resendInviteSchema, { invitationId: '1' })).toEqual({
      invitationId: ['Invalid invitation ID'],
    })
  })
})

describe('legacy public PGA schema', () => {
  it('coerces numbers, defaults blanks to 0 and keeps its messages', () => {
    const ok = publicPgaFormSchema.safeParse({ date: '2026-10-04', locationId: LOCATION, sv1: '12' })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.sv1).toBe(12)
      expect(ok.data.hc2).toBe(0)
    }
    expect(
      errors(publicPgaFormSchema, { date: '', locationId: 'x', sv1: '1.5', sv2: -1, yxp: 100001 })
    ).toEqual({
      date: ['Date is required'],
      locationId: ['Please select a valid location'],
      sv1: ['Enter a whole number'],
      sv2: ['Must be 0 or greater'],
      yxp: ['Must be 100,000 or less'],
    })
  })
})
