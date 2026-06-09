import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { createTables } from './db/schema'

// Routes
import authRoutes from './routes/auth'
import adminRoutes from './routes/admin'
import supplierRoutes from './routes/suppliers'
import productRoutes from './routes/products'
import priceRoutes from './routes/prices'
import stockRoutes from './routes/stock'
import financeRoutes from './routes/finances'
import buyingPriceRoutes from './routes/buying-prices'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet())

// CORS — allow frontend to talk to backend
// app.use(cors({
//   origin: [
//     'http://localhost:5173',
//     'https://dime-depot.vercel.app',
//   ],
//   credentials: true,
// }))

app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
}))

// Rate limiting — prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100,
  message: { error: 'Too many requests, please try again later' }
})
app.use(limiter)

// Parse JSON
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Dime-Depot API is running' })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/products', productRoutes)
app.use('/api/prices', priceRoutes)
app.use('/api/stock', stockRoutes)
app.use('/api/finances', financeRoutes)
app.use('/api/buying-prices', buyingPriceRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Start server and create tables
async function start(retries = 5) {
  for (let i = 1; i <= retries; i++) {
    try {
      await createTables()
      app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`✅ Dime-Depot API running on port ${PORT}`)
      })
      return
    } catch (error) {
      console.log(`Connection attempt ${i}/${retries} failed. Retrying in 3 seconds...`)
      if (i === retries) {
        console.error('Failed to start server after all retries')
        process.exit(1)
      }
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }
}

start()

export default app