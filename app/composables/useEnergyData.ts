import Papa from 'papaparse'

export interface CsvRow {
  time: string
  'Import T1 kWh': string
  'Import T2 kWh': string
  'Export T1 kWh': string
  'Export T2 kWh': string
}

export interface DailyEnergy {
  date: string
  importKwh: number
  exportKwh: number
}

export interface BatterySavings {
  importSavedKwh: number
  exportSavedKwh: number
}

export function useEnergyData() {
  const dailyData = ref<DailyEnergy[]>([])
  const rawRows = ref<CsvRow[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const batteryCapacity = ref<number>(0)
  const batterySavings = ref<BatterySavings | null>(null)

  function parseFile(file: File) {
    isLoading.value = true
    error.value = null
    dailyData.value = []
    rawRows.value = []
    batterySavings.value = null

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          rawRows.value = results.data
          dailyData.value = computeDaily(results.data)
          if (batteryCapacity.value > 0) {
            batterySavings.value = simulateBattery(results.data, batteryCapacity.value)
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

  watch(batteryCapacity, (cap) => {
    if (rawRows.value.length > 0 && cap > 0) {
      batterySavings.value = simulateBattery(rawRows.value, cap)
    } else {
      batterySavings.value = null
    }
  })

  return { dailyData, isLoading, error, parseFile, batteryCapacity, batterySavings }
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

export function simulateBattery(rows: CsvRow[], capacityKwh: number): BatterySavings {
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

  return {
    importSavedKwh: Math.round(importSaved * 100) / 100,
    exportSavedKwh: Math.round(exportSaved * 100) / 100,
  }
}
