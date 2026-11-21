import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { useApp } from '../lib/store'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const useColors = () => { const { dark } = useApp(); return { text: dark ? '#d4d4d4' : '#475569', grid: dark ? '#333333' : '#e2e8f0', gap: dark ? '#161616' : '#ffffff' } }

/** Doughnut chart. data = [{ label, value, color }] */
export function Donut({ data, cutout = '68%', legend = false }) {
  const c = useColors()
  return (
    <Doughnut
      data={{ labels: data.map(d => d.label), datasets: [{ data: data.map(d => d.value), backgroundColor: data.map(d => d.color), borderColor: c.gap, borderWidth: 2 }] }}
      options={{ cutout, maintainAspectRatio: false, plugins: { legend: { display: legend, position: 'bottom', labels: { color: c.text, boxWidth: 10 } }, tooltip: { enabled: legend || data.length > 2 } } }}
    />
  )
}

/** Small sparkline-style bars for the dashboard card */
export function MiniBars({ values, color = '#2563eb' }) {
  return (
    <Bar
      data={{ labels: values.map((_, i) => i + 1), datasets: [{ data: values, backgroundColor: color, borderRadius: 3 }] }}
      options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }}
    />
  )
}

/** Grouped bar chart. datasets = [{ label, data, color }] */
export function GroupBars({ labels, datasets }) {
  const c = useColors()
  return (
    <Bar
      data={{ labels, datasets: datasets.map(d => ({ label: d.label, data: d.data, backgroundColor: d.color, borderRadius: 4 })) }}
      options={{ maintainAspectRatio: false, plugins: { legend: { labels: { color: c.text } } }, scales: { x: { ticks: { color: c.text }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: c.text, precision: 0 }, grid: { color: c.grid } } } }}
    />
  )
}
