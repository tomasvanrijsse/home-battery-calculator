export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: false,
  app: {
    baseURL: '/home-battery-calculator/',
    head: {
      title: 'Energie Verbruik Viewer',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
