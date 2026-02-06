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

const chartData = computed(() => ({
  labels: props.data.map((d) => d.date),
  datasets: [
    {
      label: 'Verbruik (kWh)',
      data: props.data.map((d) => d.importKwh),
      backgroundColor: 'rgba(239, 68, 68, 0.7)',
    },
    {
      label: 'Teruglevering (kWh)',
      data: props.data.map((d) => d.exportKwh),
      backgroundColor: 'rgba(34, 197, 94, 0.7)',
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'Dagelijks energieverbruik en teruglevering',
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
}
</script>

<template>
  <div style="height: 500px">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
