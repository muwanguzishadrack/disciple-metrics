import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'
import { calculatePasswordStrength } from '@/lib/validations/auth'

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', true && 'included', false && 'excluded')).toBe(
      'base included'
    )
  })

  it('should merge tailwind classes correctly', () => {
    expect(cn('px-4 py-2', 'px-6')).toBe('py-2 px-6')
  })

  it('should handle undefined values', () => {
    expect(cn('base', undefined, 'other')).toBe('base other')
  })
})

describe('calculatePasswordStrength', () => {
  it('should return weak for short passwords', () => {
    const result = calculatePasswordStrength('abc')
    expect(result.label).toBe('Weak')
  })

  it('should return weak for passwords with only lowercase', () => {
    const result = calculatePasswordStrength('abcdefgh')
    expect(result.label).toBe('Weak')
  })

  it('should return fair for passwords with mixed case', () => {
    const result = calculatePasswordStrength('Abcdefgh')
    expect(result.label).toBe('Fair')
  })

  it('should return good for passwords with mixed case and numbers', () => {
    const result = calculatePasswordStrength('Abcdefg1')
    expect(result.label).toBe('Good')
  })

  it('should return strong for passwords with all requirements', () => {
    const result = calculatePasswordStrength('Abcdefg1!')
    expect(result.label).toBe('Strong')
  })

  it('should return strong for long complex passwords', () => {
    const result = calculatePasswordStrength('MySecurePass123!')
    expect(result.label).toBe('Strong')
  })
})
