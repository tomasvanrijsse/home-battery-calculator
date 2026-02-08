<script setup lang="ts">
const {
  dailyData,
  isLoading,
  error,
  parseFile,
  batteryCapacity,
  importTariff,
  exportTariff,
  batterySavings,
  dynamicTariffSavings,
} = useEnergyData()

const hasData = computed(() => dailyData.value.length > 0)

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    parseFile(file)
  }
}
</script>

<template>
  <div class="container">
    <h1>Energie Verbruik Viewer</h1>
    <p class="subtitle">
      Upload een CSV-bestand met je energiedata (meterstanden per 15 minuten) om
      een overzicht per dag te zien.
    </p>

    <div class="upload-section">
      <label for="csv-input" class="file-label">Kies CSV-bestand</label>
      <input
        id="csv-input"
        type="file"
        accept=".csv"
        @change="onFileChange"
      />
    </div>

    <p v-if="isLoading" class="status">Bestand wordt verwerkt...</p>
    <p v-if="error" class="error">Fout: {{ error }}</p>

    <div class="battery-section">
      <div class="input-group">
        <label for="battery-input">Thuisbatterij formaat (kWh):</label>
        <input
          id="battery-input"
          v-model.number="batteryCapacity"
          type="number"
          min="0"
          step="0.5"
        />
      </div>
      <div class="input-group">
        <label for="import-tariff">Import tarief (€/kWh):</label>
        <input
          id="import-tariff"
          v-model.number="importTariff"
          type="number"
          min="0"
          step="0.01"
        />
      </div>
      <div class="input-group">
        <label for="export-tariff">Export tarief (€/kWh):</label>
        <input
          id="export-tariff"
          v-model.number="exportTariff"
          type="number"
          min="0"
          step="0.01"
        />
      </div>
    </div>

    <div class="results">
      <p v-if="hasData" class="summary">
        {{ dailyData.length }} dagen geladen &mdash; totaal verbruik:
        <strong>
          {{ dailyData.reduce((s, d) => s + d.importKwh, 0).toFixed(1) }} kWh </strong
        >, totaal teruglevering:
        <strong>
          {{ dailyData.reduce((s, d) => s + d.exportKwh, 0).toFixed(1) }} kWh
        </strong>
      </p>
      <EnergyChart :data="dailyData" />
      <p v-if="!hasData" class="placeholder">
        Upload een CSV-bestand om de grafiek te vullen.
      </p>
    </div>

    <div class="savings-grid">
      <div class="savings">
        <h2>Batterijsimulatie</h2>
        <template v-if="batterySavings">
          <p>
            Met een thuisbatterij van <strong>{{ batteryCapacity }} kWh</strong> had
            je over deze periode:
          </p>
          <ul>
            <li>
              <strong>{{ batterySavings.exportSavedKwh }} kWh</strong> minder
              teruggeleverd (opgeslagen in batterij)
            </li>
            <li>
              <strong>{{ batterySavings.importSavedKwh }} kWh</strong> minder
              afgenomen van het net (uit batterij verbruikt)
            </li>
          </ul>
          <div v-if="batterySavings.netSavingsEur !== undefined" class="cost-summary">
            <h3>Kosten besparing</h3>
            <ul>
              <li>
                Besparing op import:
                <strong class="positive">€ {{ batterySavings.importSavingsEur?.toFixed(2) }}</strong>
              </li>
              <li>
                Gemiste export inkomsten:
                <strong class="negative">€ {{ batterySavings.exportLossEur?.toFixed(2) }}</strong>
              </li>
              <li class="net-savings">
                <strong>Netto besparing:</strong>
                <strong :class="batterySavings.netSavingsEur >= 0 ? 'positive' : 'negative'">
                  € {{ batterySavings.netSavingsEur?.toFixed(2) }}
                </strong>
              </li>
            </ul>
          </div>
        </template>
        <p v-else class="placeholder">
          Upload een CSV-bestand om de batterijsimulatie te berekenen.
        </p>
      </div>

      <div class="savings">
        <h2>Dynamische tarieven</h2>
        <template v-if="dynamicTariffSavings">
          <p>
            Met dezelfde batterij van <strong>{{ batteryCapacity }} kWh</strong>,
            's nachts laden (00:00–04:00) en tijdens piekuren ontladen
            (16:00–21:00):
          </p>
          <ul>
            <li>
              <strong>{{ dynamicTariffSavings.cheapChargedKwh }} kWh</strong>
              goedkoop geladen vanuit het net
            </li>
            <li>
              <strong>{{ dynamicTariffSavings.peakOffsetKwh }} kWh</strong>
              piekverbruik vermeden (uit batterij verbruikt)
            </li>
          </ul>
        </template>
        <p v-else class="placeholder">
          Upload een CSV-bestand om de dynamische tarieven simulatie te berekenen.
        </p>
      </div>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #f5f5f5;
  color: #1a1a1a;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

h1 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  margin-bottom: 1.5rem;
}

.upload-section {
  margin-bottom: 1.5rem;
}

.file-label {
  display: inline-block;
  padding: 0.6rem 1.2rem;
  background: #2563eb;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.file-label:hover {
  background: #1d4ed8;
}

#csv-input {
  margin-left: 1rem;
}

.status {
  color: #2563eb;
  margin-bottom: 1rem;
}

.error {
  color: #dc2626;
  margin-bottom: 1rem;
}

.results {
  margin-bottom: 1.5rem;
}

.summary {
  margin-bottom: 1rem;
  font-size: 1.05rem;
}

.placeholder {
  color: #999;
  font-style: italic;
}

.battery-section {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  padding: 1rem;
  margin-bottom: 1.5rem;
  margin-left: -1rem;
  margin-right: -1rem;
  padding-left: 1rem;
  padding-right: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid #e5e7eb;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-group label {
  font-weight: 500;
  white-space: nowrap;
}

.input-group input {
  width: 100px;
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
}

.savings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.savings {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem;
}

.savings h2 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
}

.savings ul {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}

.savings li {
  margin-bottom: 0.3rem;
}

.cost-summary {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.cost-summary h3 {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.cost-summary ul {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}

.positive {
  color: #059669;
}

.negative {
  color: #dc2626;
}

.net-savings {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
  font-size: 1.05rem;
}
</style>
