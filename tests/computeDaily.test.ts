import { describe, it, expect } from 'vitest'
import { computeDaily } from '~/composables/useEnergyData'
import type { CsvRow } from '~/composables/useEnergyData'

function row(time: string, impT1: number, impT2: number, expT1: number, expT2: number): CsvRow {
  return {
    time,
    'Import T1 kWh': String(impT1),
    'Import T2 kWh': String(impT2),
    'Export T1 kWh': String(expT1),
    'Export T2 kWh': String(expT2),
  }
}

describe('computeDaily', () => {
  it('computes daily import and export from cumulative readings', () => {
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 101, 201, 10, 20),
      row('2025-01-01 00:30', 103, 202, 10, 20),
      row('2025-01-01 00:45', 104, 203, 10, 20),
    ]

    const result = computeDaily(rows)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2025-01-01')
    // Import: (104+203) - (100+200) = 307 - 300 = 7
    expect(result[0].importKwh).toBe(7)
    // Export: (10+20) - (10+20) = 0
    expect(result[0].exportKwh).toBe(0)
  })

  it('handles multiple days sorted by date', () => {
    const rows = [
      row('2025-01-02 00:00', 200, 300, 50, 60),
      row('2025-01-02 23:45', 210, 305, 52, 63),
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 23:45', 108, 204, 12, 22),
    ]

    const result = computeDaily(rows)
    expect(result).toHaveLength(2)
    // Sorted: jan 1 first
    expect(result[0].date).toBe('2025-01-01')
    expect(result[1].date).toBe('2025-01-02')

    // Day 1: import (108+204)-(100+200) = 12, export (12+22)-(10+20) = 4
    expect(result[0].importKwh).toBe(12)
    expect(result[0].exportKwh).toBe(4)

    // Day 2: import (210+305)-(200+300) = 15, export (52+63)-(50+60) = 5
    expect(result[1].importKwh).toBe(15)
    expect(result[1].exportKwh).toBe(5)
  })

  it('skips rows with invalid numbers', () => {
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      { time: '2025-01-01 00:15', 'Import T1 kWh': 'bad', 'Import T2 kWh': '201', 'Export T1 kWh': '10', 'Export T2 kWh': '20' },
      row('2025-01-01 00:30', 103, 202, 11, 21),
    ]

    const result = computeDaily(rows)
    expect(result).toHaveLength(1)
    // Only valid rows: first and last
    expect(result[0].importKwh).toBe(5) // (103+202)-(100+200)
    expect(result[0].exportKwh).toBe(2) // (11+21)-(10+20)
  })

  it('skips rows with empty time', () => {
    const rows = [
      row('', 100, 200, 10, 20),
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 102, 201, 10, 20),
    ]

    const result = computeDaily(rows)
    expect(result).toHaveLength(1)
    expect(result[0].importKwh).toBe(3)
  })

  it('returns empty array for empty input', () => {
    expect(computeDaily([])).toEqual([])
  })

  it('rounds to 3 decimal places', () => {
    const rows = [
      row('2025-01-01 00:00', 100.001, 200.002, 10.003, 20.004),
      row('2025-01-01 00:15', 100.002, 200.003, 10.004, 20.006),
    ]

    const result = computeDaily(rows)
    // Import: (100.002+200.003) - (100.001+200.002) = 0.002
    expect(result[0].importKwh).toBe(0.002)
    // Export: (10.004+20.006) - (10.003+20.004) = 0.003
    expect(result[0].exportKwh).toBe(0.003)
  })
})
