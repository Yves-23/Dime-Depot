import { Price } from './types'

// Convert stock (casses, halves, pieces) to total pieces
export function stockToPieces(
  casses: number,
  halves: number,
  pieces: number,
  piecesPerCasse: number
): number {
  return casses * piecesPerCasse + halves * (piecesPerCasse / 2) + pieces
}

// Convert total pieces back to stock (casses, halves, pieces)
export function piecesToStock(
  totalPieces: number,
  piecesPerCasse: number
): { casses: number; halves: number; pieces: number } {
  const half = piecesPerCasse / 2
  const casses = Math.floor(totalPieces / piecesPerCasse)
  const remainder = totalPieces % piecesPerCasse
  const halves = remainder >= half ? 1 : 0
  const pieces = remainder - halves * half
  return { casses, halves, pieces }
}

// Format stock as readable string
export function formatStock(
  casses: number,
  halves: number,
  pieces: number
): string {
  const parts: string[] = []
  if (casses > 0) parts.push(`${casses} ${casses === 1 ? 'casse' : 'casses'}`)
  if (halves > 0) parts.push('1/2')
  if (pieces > 0) parts.push(`${pieces} ${pieces === 1 ? 'pc' : 'pcs'}`)
  return parts.length ? parts.join(' + ') : '0'
}

// Format number as RWF currency
export function formatRWF(amount: number): string {
  return `${Math.round(amount).toLocaleString()} RWF`
}

// Get the correct price for a product on a specific date
export function getPriceForDate(
  prices: Price[],
  productId: string,
  date: string
): number {
  const productPrices = prices
    .filter(p => p.product_id === productId && p.effective_date <= date)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))

  return productPrices.length > 0 ? productPrices[0].price_per_casse : 0
}

// Get today's date as YYYY-MM-DD string
export function today(): string {
  return new Date().toISOString().split('T')[0]
}

// Get yesterday's date as YYYY-MM-DD string
export function yesterday(date: string): string {
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

// Format date for display
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-RW', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Calculate revenue from sold pieces
export function calculateRevenue(
  soldPieces: number,
  piecesPerCasse: number,
  pricePerCasse: number
): number {
  return (soldPieces / piecesPerCasse) * pricePerCasse
}