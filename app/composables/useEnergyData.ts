import Papa from 'papaparse'

export interface CsvRow {
  time: string
  'Import T1 kWh': string
  'Import T2 kWh': string
  'Export T1 kWh': string
  'Export T2 kWh': string
}

interface ColumnMapping {
  time: string
  importT1: string
  importT2: string
  exportT1: string
  exportT2: string
}

const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  time: ['time', 'timestamp', 'datum', 'date', 'tijd'],
  importT1: ['import t1 kwh', 'import t1', 'afname t1 kwh', 'afname t1'],
  importT2: ['import t2 kwh', 'import t2', 'afname t2 kwh', 'afname t2'],
  exportT1: ['export t1 kwh', 'export t1', 'teruglevering t1 kwh', 'teruglevering t1'],
  exportT2: ['export t2 kwh', 'export t2', 'teruglevering t2 kwh', 'teruglevering t2'],
}

export function detectColumns(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim())

  function find(field: keyof ColumnMapping): string {
    const aliases = COLUMN_ALIASES[field]
    for (const alias of aliases) {
      const idx = lower.indexOf(alias)
      if (idx !== -1) return headers[idx]
    }
    throw new Error(
      `Kolom "${aliases[0]}" niet gevonden in CSV. Gevonden kolommen: ${headers.join(', ')}`
    )
  }

  return {
    time: find('time'),
    importT1: find('importT1'),
    importT2: find('importT2'),
    exportT1: find('exportT1'),
    exportT2: find('exportT2'),
  }
}

export function mapRows(rawRows: Record<string, string>[], mapping: ColumnMapping): CsvRow[] {
  return rawRows.map((raw) => ({
    time: raw[mapping.time] ?? '',
    'Import T1 kWh': raw[mapping.importT1] ?? '',
    'Import T2 kWh': raw[mapping.importT2] ?? '',
    'Export T1 kWh': raw[mapping.exportT1] ?? '',
    'Export T2 kWh': raw[mapping.exportT2] ?? '',
  }))
}

export interface DailyEnergy {
  date: string
  importKwh: number
  exportKwh: number
  importWithBatteryKwh?: number
  exportWithBatteryKwh?: number
}

export interface BatterySavings {
  importSavedKwh: number
  exportSavedKwh: number
  importSavingsEur?: number
  exportLossEur?: number
  netSavingsEur?: number
}

export interface DynamicTariffSavings {
  cheapChargedKwh: number
  peakOffsetKwh: number
}

export function useEnergyData() {
  const dailyData = ref<DailyEnergy[]>([])
  const rawRows = ref<CsvRow[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const batteryCapacity = ref<number>(5)
  const importTariff = ref<number>(0.25)
  const exportTariff = ref<number>(0.15)
  const batterySavings = ref<BatterySavings | null>(null)
  const dynamicTariffSavings = ref<DynamicTariffSavings | null>(null)

  function parseFile(file: File) {
    isLoading.value = true
    error.value = null
    dailyData.value = []
    rawRows.value = []
    batterySavings.value = null
    dynamicTariffSavings.value = null

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          const headers = results.meta.fields ?? []
          const mapping = detectColumns(headers)
          const mapped = mapRows(results.data as Record<string, string>[], mapping)
          rawRows.value = mapped
          dailyData.value = computeDaily(mapped)
          if (batteryCapacity.value > 0) {
            batterySavings.value = simulateBattery(
              mapped,
              batteryCapacity.value,
              importTariff.value,
              exportTariff.value
            )
            dynamicTariffSavings.value = simulateDynamicTariff(mapped, batteryCapacity.value)
          }
        } catch (e) {
          error.value = (e as Error).message
        } finally {
          isLoading.value = false
        }
      },
      error(err) {
        error.value = err.message
        isLoading.value = false
      },
    })
  }

  function recalculateSavings() {
    if (rawRows.value.length > 0 && batteryCapacity.value > 0) {
      batterySavings.value = simulateBattery(
        rawRows.value,
        batteryCapacity.value,
        importTariff.value,
        exportTariff.value
      )
      dynamicTariffSavings.value = simulateDynamicTariff(rawRows.value, batteryCapacity.value)
      dailyData.value = computeDailyWithBattery(rawRows.value, batteryCapacity.value)
    } else {
      batterySavings.value = null
      dynamicTariffSavings.value = null
      if (rawRows.value.length > 0) {
        dailyData.value = computeDaily(rawRows.value)
      }
    }
  }

  watch([batteryCapacity, importTariff, exportTariff], recalculateSavings)

  return {
    dailyData,
    isLoading,
    error,
    parseFile,
    batteryCapacity,
    importTariff,
    exportTariff,
    batterySavings,
    dynamicTariffSavings,
  }
}

export function computeDaily(rows: CsvRow[]): DailyEnergy[] {
  const byDate = new Map<string, { imports: number[]; exports: number[] }>()

  for (const row of rows) {
    if (!row.time) continue
    const date = row.time.substring(0, 10)

    const totalImport = parseFloat(row['Import T1 kWh']) + parseFloat(row['Import T2 kWh'])
    const totalExport = parseFloat(row['Export T1 kWh']) + parseFloat(row['Export T2 kWh'])

    if (isNaN(totalImport) || isNaN(totalExport)) continue

    if (!byDate.has(date)) {
      byDate.set(date, { imports: [], exports: [] })
    }
    const day = byDate.get(date)!
    day.imports.push(totalImport)
    day.exports.push(totalExport)
  }

  const result: DailyEnergy[] = []
  for (const [date, { imports, exports }] of byDate) {
    const importKwh = imports[imports.length - 1] - imports[0]
    const exportKwh = exports[exports.length - 1] - exports[0]
    result.push({
      date,
      importKwh: Math.round(importKwh * 1000) / 1000,
      exportKwh: Math.round(exportKwh * 1000) / 1000,
    })
  }

  result.sort((a, b) => a.date.localeCompare(b.date))
  return result
}

export function simulateBattery(
  rows: CsvRow[],
  capacityKwh: number,
  importTariff = 0,
  exportTariff = 0
): BatterySavings {
  let batteryLevel = 0
  let importSaved = 0
  let exportSaved = 0

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]
    const curr = rows[i]

    if (!prev.time || !curr.time) continue

    const prevImport = parseFloat(prev['Import T1 kWh']) + parseFloat(prev['Import T2 kWh'])
    const currImport = parseFloat(curr['Import T1 kWh']) + parseFloat(curr['Import T2 kWh'])
    const prevExport = parseFloat(prev['Export T1 kWh']) + parseFloat(prev['Export T2 kWh'])
    const currExport = parseFloat(curr['Export T1 kWh']) + parseFloat(curr['Export T2 kWh'])

    if (isNaN(prevImport) || isNaN(currImport) || isNaN(prevExport) || isNaN(currExport)) continue

    const intervalImport = currImport - prevImport
    const intervalExport = currExport - prevExport

    // Net grid flow: positive = importing, negative = exporting
    const net = intervalImport - intervalExport

    if (net < 0) {
      // Surplus: we're exporting. Charge the battery.
      const surplus = -net
      const spaceInBattery = capacityKwh - batteryLevel
      const charge = Math.min(surplus, spaceInBattery)
      batteryLevel += charge
      exportSaved += charge
    } else if (net > 0) {
      // Deficit: we're importing. Discharge the battery.
      const discharge = Math.min(net, batteryLevel)
      batteryLevel -= discharge
      importSaved += discharge
    }
  }

  const importSavedKwh = Math.round(importSaved * 100) / 100
  const exportSavedKwh = Math.round(exportSaved * 100) / 100

  const result: BatterySavings = {
    importSavedKwh,
    exportSavedKwh,
  }

  if (importTariff > 0 || exportTariff > 0) {
    const importSavingsEur = Math.round(importSavedKwh * importTariff * 100) / 100
    const exportLossEur = Math.round(exportSavedKwh * exportTariff * 100) / 100
    const netSavingsEur = Math.round((importSavingsEur - exportLossEur) * 100) / 100

    result.importSavingsEur = importSavingsEur
    result.exportLossEur = exportLossEur
    result.netSavingsEur = netSavingsEur
  }

  return result
}

export function computeDailyWithBattery(rows: CsvRow[], capacityKwh: number): DailyEnergy[] {
  // Track daily savings
  const dailySavings = new Map<string, { importSaved: number; exportSaved: number }>()

  let batteryLevel = 0

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]
    const curr = rows[i]

    if (!prev.time || !curr.time) continue

    const date = curr.time.substring(0, 10)

    const prevImport = parseFloat(prev['Import T1 kWh']) + parseFloat(prev['Import T2 kWh'])
    const currImport = parseFloat(curr['Import T1 kWh']) + parseFloat(curr['Import T2 kWh'])
    const prevExport = parseFloat(prev['Export T1 kWh']) + parseFloat(prev['Export T2 kWh'])
    const currExport = parseFloat(curr['Export T1 kWh']) + parseFloat(curr['Export T2 kWh'])

    if (isNaN(prevImport) || isNaN(currImport) || isNaN(prevExport) || isNaN(currExport)) continue

    const intervalImport = currImport - prevImport
    const intervalExport = currExport - prevExport

    // Net grid flow: positive = importing, negative = exporting
    const net = intervalImport - intervalExport

    if (!dailySavings.has(date)) {
      dailySavings.set(date, { importSaved: 0, exportSaved: 0 })
    }
    const daySavings = dailySavings.get(date)!

    if (net < 0) {
      // Surplus: we're exporting. Charge the battery.
      const surplus = -net
      const spaceInBattery = capacityKwh - batteryLevel
      const charge = Math.min(surplus, spaceInBattery)
      batteryLevel += charge
      daySavings.exportSaved += charge
    } else if (net > 0) {
      // Deficit: we're importing. Discharge the battery.
      const discharge = Math.min(net, batteryLevel)
      batteryLevel -= discharge
      daySavings.importSaved += discharge
    }
  }

  // Compute daily totals and apply battery savings
  const daily = computeDaily(rows)

  for (const day of daily) {
    const savings = dailySavings.get(day.date)
    if (savings) {
      day.importWithBatteryKwh = Math.round((day.importKwh - savings.importSaved) * 1000) / 1000
      day.exportWithBatteryKwh = Math.round((day.exportKwh - savings.exportSaved) * 1000) / 1000
    }
  }

  return daily
}

function getHour(time: string): number {
  // time format: "2025-01-01 00:15"
  return parseInt(time.substring(11, 13), 10)
}

export function simulateDynamicTariff(rows: CsvRow[], capacityKwh: number): DynamicTariffSavings {
  let batteryLevel = 0
  let cheapCharged = 0
  let peakOffset = 0

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]
    const curr = rows[i]

    if (!prev.time || !curr.time) continue

    const hour = getHour(curr.time)

    const prevImport = parseFloat(prev['Import T1 kWh']) + parseFloat(prev['Import T2 kWh'])
    const currImport = parseFloat(curr['Import T1 kWh']) + parseFloat(curr['Import T2 kWh'])

    if (isNaN(prevImport) || isNaN(currImport)) continue

    const intervalImport = currImport - prevImport

    if (hour >= 0 && hour < 4) {
      // Cheap hours: charge battery from grid
      const space = capacityKwh - batteryLevel
      const charge = Math.min(space, capacityKwh / 16) // spread across 16 intervals (4h)
      batteryLevel += charge
      cheapCharged += charge
    } else if (hour >= 16 && hour < 21) {
      // Peak hours: discharge battery to offset import
      const discharge = Math.min(batteryLevel, intervalImport)
      batteryLevel -= discharge
      peakOffset += discharge
    }
  }

  return {
    cheapChargedKwh: Math.round(cheapCharged * 100) / 100,
    peakOffsetKwh: Math.round(peakOffset * 100) / 100,
  }
}
