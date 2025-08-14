import express from 'express'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import { connectDB } from '~/configs/db.connect.js'
import { router } from '~/routes/index.js'

// 1. Nạp biến môi trường từ .env
dotenv.config()

const app = express()
app.use(cookieParser())
app.use(
  cors({
    origin: 'https://vigroup-client.vercel.app',
    methods: ['POST', 'PUT', 'GET', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

const PORT = process.env.PORT || 5000

// 2. Kết nối Database
connectDB()

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.set('trust proxy', 1)

// 3. Serve static từ React build
const __dirname = path.resolve()
app.use(express.static(path.join(__dirname, 'build')))

// 9. Các route API khác
app.use('/api', router)
app.get('/api', (req, res) => {
  res.send('API sẵn sàng')
})
app.get('/api/product', (req, res) => {
  res.send('API product sẵn sàng')
})

// 10. Serve React app cho các route chưa matching /api
/* app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'))
}) */

// 11. Khởi động server
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`)
})
