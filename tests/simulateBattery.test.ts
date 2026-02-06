import { describe, it, expect } from 'vitest'
import { simulateBattery } from '~/composables/useEnergyData'
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

describe('simulateBattery', () => {
  it('charges battery from export surplus', () => {
    // Interval: no import, 2 kWh export → battery charges 2 kWh
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 100, 200, 11, 21), // 0 import, 2 export
    ]

    const result = simulateBattery(rows, 10)
    expect(result.exportSavedKwh).toBe(2)
    expect(result.importSavedKwh).toBe(0)
  })

  it('discharges battery during import', () => {
    // First interval: export 3 kWh (charges battery)
    // Second interval: import 2 kWh (discharges battery)
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 100, 200, 11.5, 21.5), // 0 import, 3 export
      row('2025-01-01 00:30', 101, 201, 11.5, 21.5),  // 2 import, 0 export
    ]

    const result = simulateBattery(rows, 10)
    expect(result.exportSavedKwh).toBe(3)
    expect(result.importSavedKwh).toBe(2)
  })

  it('limits charge to battery capacity', () => {
    // Export 5 kWh but battery is only 2 kWh
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 100, 200, 13, 22), // 0 import, 5 export
    ]

    const result = simulateBattery(rows, 2)
    expect(result.exportSavedKwh).toBe(2) // capped at capacity
  })

  it('limits discharge to available battery level', () => {
    // Charge 2 kWh, then try to discharge 5 kWh
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 100, 200, 11, 21), // charge 2 kWh
      row('2025-01-01 00:30', 103, 202, 11, 21),  // import 5 kWh
    ]

    const result = simulateBattery(rows, 10)
    expect(result.exportSavedKwh).toBe(2)
    expect(result.importSavedKwh).toBe(2) // only 2 available
  })

  it('handles full charge-discharge cycle', () => {
    // Battery of 3 kWh
    // Export 5 → charges 3 (full)
    // Import 2 → discharges 2 (level: 1)
    // Export 1 → charges 1 (level: 2)
    // Import 4 → discharges 2 (level: 0)
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 100, 200, 13, 22), // export 5
      row('2025-01-01 00:30', 101, 201, 13, 22),  // import 2
      row('2025-01-01 00:45', 101, 201, 13.5, 22.5), // export 1
      row('2025-01-01 01:00', 103, 203, 13.5, 22.5), // import 4
    ]

    const result = simulateBattery(rows, 3)
    expect(result.exportSavedKwh).toBe(4)  // 3 + 1
    expect(result.importSavedKwh).toBe(4)  // 2 + 2
  })

  it('returns zeros for single row', () => {
    const rows = [row('2025-01-01 00:00', 100, 200, 10, 20)]
    const result = simulateBattery(rows, 10)
    expect(result.importSavedKwh).toBe(0)
    expect(result.exportSavedKwh).toBe(0)
  })

  it('returns zeros for empty input', () => {
    const result = simulateBattery([], 10)
    expect(result.importSavedKwh).toBe(0)
    expect(result.exportSavedKwh).toBe(0)
  })

  it('skips intervals with invalid data', () => {
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      { time: '2025-01-01 00:15', 'Import T1 kWh': 'bad', 'Import T2 kWh': '200', 'Export T1 kWh': '11', 'Export T2 kWh': '21' },
      row('2025-01-01 00:30', 100, 200, 12, 22), // export 2 vs previous valid
    ]

    // Invalid row is skipped; interval from row 0 to row 2 is NOT computed
    // because simulation only compares consecutive rows
    const result = simulateBattery(rows, 10)
    // Row 0→1: skipped (invalid)
    // Row 1→2: skipped (row 1 invalid)
    expect(result.exportSavedKwh).toBe(0)
    expect(result.importSavedKwh).toBe(0)
  })

  it('handles net-zero intervals (no import or export change)', () => {
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 100, 200, 10, 20), // no change
    ]

    const result = simulateBattery(rows, 10)
    expect(result.exportSavedKwh).toBe(0)
    expect(result.importSavedKwh).toBe(0)
  })

  it('calculates costs when tariffs are provided', () => {
    // Charge 3 kWh from export, discharge 2 kWh for import
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 100, 200, 11.5, 21.5), // export 3 kWh
      row('2025-01-01 00:30', 101, 201, 11.5, 21.5),  // import 2 kWh
    ]

    const result = simulateBattery(rows, 10, 0.25, 0.10)
    expect(result.exportSavedKwh).toBe(3)
    expect(result.importSavedKwh).toBe(2)
    expect(result.importSavingsEur).toBe(0.50) // 2 * 0.25
    expect(result.exportLossEur).toBe(0.30) // 3 * 0.10
    expect(result.netSavingsEur).toBe(0.20) // 0.50 - 0.30
  })

  it('does not calculate costs when tariffs are zero', () => {
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 100, 200, 11, 21), // export 2 kWh
    ]

    const result = simulateBattery(rows, 10, 0, 0)
    expect(result.exportSavedKwh).toBe(2)
    expect(result.importSavingsEur).toBeUndefined()
    expect(result.exportLossEur).toBeUndefined()
    expect(result.netSavingsEur).toBeUndefined()
  })

  it('handles negative net savings correctly', () => {
    // Export saved is expensive (0.30), import saved is cheap (0.10)
    const rows = [
      row('2025-01-01 00:00', 100, 200, 10, 20),
      row('2025-01-01 00:15', 100, 200, 15, 25), // export 10 kWh
      row('2025-01-01 00:30', 101, 201, 15, 25),  // import 2 kWh
    ]

    const result = simulateBattery(rows, 10, 0.10, 0.30)
    expect(result.exportSavedKwh).toBe(10)
    expect(result.importSavedKwh).toBe(2)
    expect(result.importSavingsEur).toBe(0.20) // 2 * 0.10
    expect(result.exportLossEur).toBe(3.00) // 10 * 0.30
    expect(result.netSavingsEur).toBe(-2.80) // 0.20 - 3.00
  })
})
