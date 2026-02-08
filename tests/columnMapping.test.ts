import { describe, it, expect } from 'vitest'
import { detectColumns, mapRows } from '~/composables/useEnergyData'

describe('detectColumns', () => {
  it('detects standard column names', () => {
    const headers = ['time', 'Import T1 kWh', 'Import T2 kWh', 'Export T1 kWh', 'Export T2 kWh']
    const mapping = detectColumns(headers)
    expect(mapping.time).toBe('time')
    expect(mapping.importT1).toBe('Import T1 kWh')
    expect(mapping.importT2).toBe('Import T2 kWh')
    expect(mapping.exportT1).toBe('Export T1 kWh')
    expect(mapping.exportT2).toBe('Export T2 kWh')
  })

  it('detects columns regardless of order', () => {
    const headers = ['Export T2 kWh', 'Import T2 kWh', 'time', 'Export T1 kWh', 'Import T1 kWh']
    const mapping = detectColumns(headers)
    expect(mapping.time).toBe('time')
    expect(mapping.importT1).toBe('Import T1 kWh')
    expect(mapping.importT2).toBe('Import T2 kWh')
    expect(mapping.exportT1).toBe('Export T1 kWh')
    expect(mapping.exportT2).toBe('Export T2 kWh')
  })

  it('detects columns with extra columns present', () => {
    const headers = ['time', 'Import T1 kWh', 'Import T2 kWh', 'Export T1 kWh', 'Export T2 kWh', 'L1 max W', 'L2 max W', 'L3 max W']
    const mapping = detectColumns(headers)
    expect(mapping.time).toBe('time')
    expect(mapping.importT1).toBe('Import T1 kWh')
  })

  it('detects timestamp as time column', () => {
    const headers = ['timestamp', 'Import T1 kWh', 'Import T2 kWh', 'Export T1 kWh', 'Export T2 kWh']
    const mapping = detectColumns(headers)
    expect(mapping.time).toBe('timestamp')
  })

  it('detects datum as time column', () => {
    const headers = ['datum', 'Import T1 kWh', 'Import T2 kWh', 'Export T1 kWh', 'Export T2 kWh']
    const mapping = detectColumns(headers)
    expect(mapping.time).toBe('datum')
  })

  it('detects Dutch afname/teruglevering variants', () => {
    const headers = ['time', 'Afname T1 kWh', 'Afname T2 kWh', 'Teruglevering T1 kWh', 'Teruglevering T2 kWh']
    const mapping = detectColumns(headers)
    expect(mapping.importT1).toBe('Afname T1 kWh')
    expect(mapping.importT2).toBe('Afname T2 kWh')
    expect(mapping.exportT1).toBe('Teruglevering T1 kWh')
    expect(mapping.exportT2).toBe('Teruglevering T2 kWh')
  })

  it('is case-insensitive', () => {
    const headers = ['TIME', 'IMPORT T1 KWH', 'IMPORT T2 KWH', 'EXPORT T1 KWH', 'EXPORT T2 KWH']
    const mapping = detectColumns(headers)
    expect(mapping.time).toBe('TIME')
    expect(mapping.importT1).toBe('IMPORT T1 KWH')
  })

  it('throws error for missing column', () => {
    const headers = ['time', 'Import T1 kWh']
    expect(() => detectColumns(headers)).toThrow('niet gevonden in CSV')
  })
})

describe('mapRows', () => {
  it('maps raw rows to CsvRow using column mapping', () => {
    const mapping = {
      time: 'datum',
      importT1: 'Afname T1',
      importT2: 'Afname T2',
      exportT1: 'Terug T1',
      exportT2: 'Terug T2',
    }

    const rawRows = [
      { datum: '2025-01-01 00:00', 'Afname T1': '100', 'Afname T2': '200', 'Terug T1': '10', 'Terug T2': '20' },
      { datum: '2025-01-01 00:15', 'Afname T1': '101', 'Afname T2': '201', 'Terug T1': '10', 'Terug T2': '20' },
    ]

    const result = mapRows(rawRows, mapping)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      time: '2025-01-01 00:00',
      'Import T1 kWh': '100',
      'Import T2 kWh': '200',
      'Export T1 kWh': '10',
      'Export T2 kWh': '20',
    })
  })

  it('handles missing values as empty strings', () => {
    const mapping = {
      time: 'time',
      importT1: 'col1',
      importT2: 'col2',
      exportT1: 'col3',
      exportT2: 'col4',
    }

    const rawRows = [{ time: '2025-01-01 00:00' }]
    const result = mapRows(rawRows, mapping)
    expect(result[0]['Import T1 kWh']).toBe('')
  })
})
