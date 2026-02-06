<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { DailyEnergy } from '~/composables/useEnergyData'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{
  data: DailyEnergy[]
}>()

const hasBatteryData = computed(() =>
  props.data.some((d) => d.importWithBatteryKwh !== undefined)
)

const chartData = computed(() => {
  const datasets = []

  if (hasBatteryData.value) {
    // Show battery-adjusted data
    datasets.push(
      {
        label: 'Verbruik met batterij (kWh)',
        data: props.data.map((d) => d.importWithBatteryKwh ?? d.importKwh),
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
      },
      {
        label: 'Teruglevering met batterij (kWh)',
        data: props.data.map((d) => d.exportWithBatteryKwh ?? d.exportKwh),
        backgroundColor: 'rgba(34, 197, 94, 0.9)',
      },
      {
        label: 'Verbruik zonder batterij (kWh)',
        data: props.data.map((d) => d.importKwh),
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
      },
      {
        label: 'Teruglevering zonder batterij (kWh)',
        data: props.data.map((d) => d.exportKwh),
        backgroundColor: 'rgba(34, 197, 94, 0.3)',
      }
    )
  } else {
    // Show original data only
    datasets.push(
      {
        label: 'Verbruik (kWh)',
        data: props.data.map((d) => d.importKwh),
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
      },
      {
        label: 'Teruglevering (kWh)',
        data: props.data.map((d) => d.exportKwh),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
      }
    )
  }

  return {
    labels: props.data.map((d) => d.date),
    datasets,
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: hasBatteryData.value
        ? 'Dagelijks energieverbruik en teruglevering (met en zonder batterij)'
        : 'Dagelijks energieverbruik en teruglevering',
    },
    legend: {
      position: 'top' as const,
    },
  },
  scales: {
    x: {
      ticks: {
        maxTicksLimit: 30,
      },
    },
    y: {
      title: {
        display: true,
        text: 'kWh',
      },
    },
  },
}))
</script>

<template>
  <div style="height: 500px">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
