import { describe, it, expect } from 'vitest'
import { simulateDynamicTariff } from '~/composables/useEnergyData'
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

describe('simulateDynamicTariff', () => {
  it('charges battery during cheap hours (00:00-04:00)', () => {
    // 4 intervals in cheap hours → charges capacity/16 per interval = 4 * (10/16) = 2.5
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 101, 200, 10, 20),
      row('2025-01-01 00:30', 102, 200, 10, 20),
      row('2025-01-01 00:45', 103, 200, 10, 20),
      row('2025-01-01 01:00', 104, 200, 10, 20),
    ]

    const result = simulateDynamicTariff(rows, 10)
    // 4 intervals × (10/16) = 2.5 kWh charged
    expect(result.cheapChargedKwh).toBe(2.5)
    expect(result.peakOffsetKwh).toBe(0)
  })

  it('discharges battery during peak hours (16:00-21:00) to offset import', () => {
    // First fill battery in cheap hours, then discharge in peak
    // 17 rows = 16 cheap intervals → fully charges 10 kWh battery (16 × 10/16)
    const rows = [
      row('2024-12-31 23:45', 99, 200, 10, 20), // anchor row before cheap window
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 101, 200, 10, 20),
      row('2025-01-01 00:30', 102, 200, 10, 20),
      row('2025-01-01 00:45', 103, 200, 10, 20),
      row('2025-01-01 01:00', 104, 200, 10, 20),
      row('2025-01-01 01:15', 105, 200, 10, 20),
      row('2025-01-01 01:30', 106, 200, 10, 20),
      row('2025-01-01 01:45', 107, 200, 10, 20),
      row('2025-01-01 02:00', 108, 200, 10, 20),
      row('2025-01-01 02:15', 109, 200, 10, 20),
      row('2025-01-01 02:30', 110, 200, 10, 20),
      row('2025-01-01 02:45', 111, 200, 10, 20),
      row('2025-01-01 03:00', 112, 200, 10, 20),
      row('2025-01-01 03:15', 113, 200, 10, 20),
      row('2025-01-01 03:30', 114, 200, 10, 20),
      row('2025-01-01 03:45', 115, 200, 10, 20),
      // Battery now full (10 kWh): 16 intervals × 0.625
      // Non-peak gap so transition interval doesn't count as peak discharge
      row('2025-01-01 15:45', 116, 200, 10, 20),
      // Peak hours: import 3 kWh per interval
      row('2025-01-01 16:00', 116, 200, 10, 20),
      row('2025-01-01 16:15', 119, 200, 10, 20), // 3 kWh import
      row('2025-01-01 16:30', 122, 200, 10, 20), // 3 kWh import
    ]

    const result = simulateDynamicTariff(rows, 10)
    expect(result.cheapChargedKwh).toBe(10) // fully charged
    expect(result.peakOffsetKwh).toBe(6)    // 2 × 3 kWh offset (16:00 interval has 0 import)
  })

  it('does not charge outside cheap hours', () => {
    const rows = [
      row('2025-01-01 05:00', 100, 200, 10, 20),
      row('2025-01-01 05:15', 101, 200, 10, 20),
      row('2025-01-01 10:00', 102, 200, 10, 20),
      row('2025-01-01 10:15', 103, 200, 10, 20),
    ]

    const result = simulateDynamicTariff(rows, 10)
    expect(result.cheapChargedKwh).toBe(0)
  })

  it('does not discharge outside peak hours', () => {
    // Charge in cheap hours, then have import outside peak
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 101, 200, 10, 20), // charges
      // Import at 10:00 (not peak)
      row('2025-01-01 10:00', 102, 200, 10, 20),
      row('2025-01-01 10:15', 105, 200, 10, 20), // 3 kWh import, but not peak
    ]

    const result = simulateDynamicTariff(rows, 10)
    expect(result.cheapChargedKwh).toBe(0.63) // 10/16 rounded
    expect(result.peakOffsetKwh).toBe(0) // not discharged outside peak
  })

  it('limits peak discharge to battery level', () => {
    // Small battery: 1 kWh, big peak import
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 101, 200, 10, 20), // cheap: charges 1/16 = 0.0625
      // Peak: tries to discharge 5 kWh but only 0.0625 available
      row('2025-01-01 16:00', 102, 200, 10, 20),
      row('2025-01-01 16:15', 107, 200, 10, 20), // 5 kWh import
    ]

    const result = simulateDynamicTariff(rows, 1)
    expect(result.cheapChargedKwh).toBe(0.06) // 1/16 rounded
    expect(result.peakOffsetKwh).toBe(0.06)   // limited to battery level
  })

  it('limits charge to remaining battery capacity', () => {
    // Battery of 2 kWh. Generate rows from 23:45 to 08:00 to get 16+ cheap intervals
    // Anchor at 23:45, then 00:00-03:45 = 16 cheap intervals, then 04:00+ non-cheap
    const times: CsvRow[] = [
      row('2024-12-31 23:45', 99, 200, 10, 20), // anchor row
    ]
    for (let i = 0; i <= 32; i++) {
      const h = Math.floor(i / 4)
      const m = (i % 4) * 15
      const time = `2025-01-01 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      times.push(row(time, 100 + i, 200, 10, 20))
    }

    const result = simulateDynamicTariff(times, 2)
    // 16 cheap intervals × 2/16 = 2 kWh, capped at capacity
    expect(result.cheapChargedKwh).toBe(2)
  })

  it('returns zeros for empty input', () => {
    const result = simulateDynamicTariff([], 10)
    expect(result.cheapChargedKwh).toBe(0)
    expect(result.peakOffsetKwh).toBe(0)
  })

  it('handles multiple days (charge and discharge cycle repeats)', () => {
    const rows = [
      // Day 1 cheap: 1 interval
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 101, 200, 10, 20), // cheap interval, charge 5/16=0.3125
      // Day 1 peak: 1 interval
      row('2025-01-01 16:00', 110, 200, 10, 20),
      row('2025-01-01 16:15', 112, 200, 10, 20), // discharge min(0.3125, 2)=0.3125
      // Transition to day 2: interval 16:15→00:00 has hour=0 → cheap, charge 0.3125
      row('2025-01-02 00:00', 115, 200, 10, 20),
      // Another cheap interval: charge 0.3125
      row('2025-01-02 00:15', 116, 200, 10, 20),
      // Day 2 peak
      row('2025-01-02 16:00', 120, 200, 10, 20),
      row('2025-01-02 16:15', 123, 200, 10, 20), // discharge min(0.625, 3)=0.625
    ]

    const result = simulateDynamicTariff(rows, 5)
    // Cheap: 3 intervals × 0.3125 = 0.9375 → 0.94
    // Peak: 0.3125 + 0.625 = 0.9375 → 0.94
    expect(result.cheapChargedKwh).toBe(0.94)
    expect(result.peakOffsetKwh).toBe(0.94)
  })
})
