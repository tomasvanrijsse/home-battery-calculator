<script setup lang="ts">
const { dailyData, isLoading, error, parseFile, batteryCapacity, batterySavings } = useEnergyData()

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

    <div v-if="dailyData.length > 0" class="battery-section">
      <label for="battery-input">Thuisbatterij formaat (kWh):</label>
      <input
        id="battery-input"
        v-model.number="batteryCapacity"
        type="number"
        min="0"
        step="0.5"
        placeholder="bijv. 10"
      />
    </div>

    <div v-if="batterySavings" class="savings">
      <h2>Batterijsimulatie</h2>
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
    </div>

    <p v-if="isLoading" class="status">Bestand wordt verwerkt...</p>
    <p v-if="error" class="error">Fout: {{ error }}</p>

    <div v-if="dailyData.length > 0" class="results">
      <p class="summary">
        {{ dailyData.length }} dagen geladen &mdash; totaal verbruik:
        <strong>
          {{ dailyData.reduce((s, d) => s + d.importKwh, 0).toFixed(1) }} kWh </strong
        >, totaal teruglevering:
        <strong>
          {{ dailyData.reduce((s, d) => s + d.exportKwh, 0).toFixed(1) }} kWh
        </strong>
      </p>
      <EnergyChart :data="dailyData" />
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
  margin-top: 1rem;
}

.summary {
  margin-bottom: 1rem;
  font-size: 1.05rem;
}

.battery-section {
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.battery-section label {
  font-weight: 500;
}

#battery-input {
  width: 100px;
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
}

.savings {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
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
</style>
