import Papa from 'papaparse'

interface CsvRow {
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

export function useEnergyData() {
  const dailyData = ref<DailyEnergy[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function parseFile(file: File) {
    isLoading.value = true
    error.value = null
    dailyData.value = []

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          dailyData.value = computeDaily(results.data)
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

  return { dailyData, isLoading, error, parseFile }
}

function computeDaily(rows: CsvRow[]): DailyEnergy[] {
  // Group rows by date
  const byDate = new Map<string, { imports: number[]; exports: number[] }>()

  for (const row of rows) {
    if (!row.time) continue
    const date = row.time.substring(0, 10) // 'YYYY-MM-DD'

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

  // For each day, daily usage = last cumulative reading - first cumulative reading
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
