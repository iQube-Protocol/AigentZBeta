import { describe, it, expect } from 'vitest'
import {
  calculateRiskScore,
  getRiskLevel,
  getDefaultSensitivity,
  getDefaultFields,
} from '../types/iqube'

// ─── Risk score calculation ───────────────────────────────────────────────────

describe('calculateRiskScore', () => {
  it('returns low score for low sensitivity + high trust', () => {
    // sensitivity=1, verifiability=10, accuracy=10
    // raw = 1*0.5 + (10 - 10)*0.5 = 0.5 → rounds to 1
    expect(calculateRiskScore(1, 10, 10)).toBe(1)
  })

  it('returns high score for high sensitivity + low trust', () => {
    expect(calculateRiskScore(10, 0, 0)).toBe(10)
  })

  it('returns medium for mid values', () => {
    const score = calculateRiskScore(5, 5, 5)
    expect(score).toBeGreaterThanOrEqual(3)
    expect(score).toBeLessThanOrEqual(7)
  })

  it('clamps to 0 minimum', () => {
    expect(calculateRiskScore(0, 10, 10)).toBeGreaterThanOrEqual(0)
  })

  it('clamps to 10 maximum', () => {
    expect(calculateRiskScore(10, 0, 0)).toBeLessThanOrEqual(10)
  })
})

// ─── Risk level buckets ───────────────────────────────────────────────────────

describe('getRiskLevel', () => {
  it('score 0–3 → low', () => {
    expect(getRiskLevel(0)).toBe('low')
    expect(getRiskLevel(3)).toBe('low')
  })

  it('score 4–6 → medium', () => {
    expect(getRiskLevel(4)).toBe('medium')
    expect(getRiskLevel(6)).toBe('medium')
  })

  it('score 7–8 → high', () => {
    expect(getRiskLevel(7)).toBe('high')
    expect(getRiskLevel(8)).toBe('high')
  })

  it('score 9–10 → critical', () => {
    expect(getRiskLevel(9)).toBe('critical')
    expect(getRiskLevel(10)).toBe('critical')
  })
})

// ─── Default sensitivity by type ─────────────────────────────────────────────

describe('getDefaultSensitivity', () => {
  it('DataQube Credentials is high sensitivity (8)', () => {
    expect(getDefaultSensitivity('DataQube', 'Credentials')).toBe(8)
  })

  it('DataQube Health is highest sensitivity (9)', () => {
    expect(getDefaultSensitivity('DataQube', 'Health')).toBe(9)
  })

  it('ContentQube is low sensitivity (2)', () => {
    expect(getDefaultSensitivity('ContentQube', 'Article')).toBe(2)
  })

  it('returns a number between 1 and 10 for any input', () => {
    const score = getDefaultSensitivity('AgentQube', 'Chatbot')
    expect(score).toBeGreaterThanOrEqual(1)
    expect(score).toBeLessThanOrEqual(10)
  })
})

// ─── Default fields by type ───────────────────────────────────────────────────

describe('getDefaultFields', () => {
  it('DataQube Credentials returns username + password fields', () => {
    const fields = getDefaultFields('DataQube', 'Credentials')
    const keys = fields.map(f => f.key)
    expect(keys).toContain('username')
    expect(keys).toContain('password')
  })

  it('password field is marked as secret', () => {
    const fields = getDefaultFields('DataQube', 'Credentials')
    const password = fields.find(f => f.key === 'password')
    expect(password?.isSecret).toBe(true)
  })

  it('username field is NOT marked as secret', () => {
    const fields = getDefaultFields('DataQube', 'Credentials')
    const username = fields.find(f => f.key === 'username')
    expect(username?.isSecret).toBe(false)
  })

  it('ContentQube returns file_url field', () => {
    const fields = getDefaultFields('ContentQube', 'Article')
    const keys = fields.map(f => f.key)
    expect(keys).toContain('file_url')
  })

  it('ToolQube returns api_key as secret', () => {
    const fields = getDefaultFields('ToolQube', 'REST API')
    const apiKey = fields.find(f => f.key === 'api_key')
    expect(apiKey?.isSecret).toBe(true)
  })

  it('all fields have key, label, value, isSecret', () => {
    const fields = getDefaultFields('DataQube', 'Financial')
    for (const f of fields) {
      expect(f).toHaveProperty('key')
      expect(f).toHaveProperty('label')
      expect(f).toHaveProperty('value')
      expect(f).toHaveProperty('isSecret')
    }
  })
})
