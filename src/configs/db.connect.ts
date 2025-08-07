import mongoose from 'mongoose'
import dotenv from 'dotenv'

//* Nạp biến môi trường từ tệp .env
dotenv.config()

//* Hàm kết nối MongoDB
export const connectDB = async () => {
  try {
    //! Kết nối với MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vigroup',
    )

    console.log('✅ Kết nối MongoDB thành công')

    //* Lắng nghe sự kiện lỗi kết nối nếu chưa được đăng ký trước đó
    if (!mongoose.connection.listeners('error').length) {
      mongoose.connection.on('error', error => {
        console.error(`❌ Lỗi kết nối MongoDB: ${error}`)
      })
    }

    //* Lắng nghe sự kiện mất kết nối nếu chưa được đăng ký trước đó
    if (!mongoose.connection.listeners('disconnected').length) {
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ Kết nối MongoDB đã bị ngắt')
      })
    }
  } catch (error) {
    //! Xử lý lỗi nếu không thể kết nối
    console.error('❌ Lỗi khi kết nối MongoDB:', error)
    process.exit(1) // Dừng chương trình nếu kết nối thất bại
  }
}
