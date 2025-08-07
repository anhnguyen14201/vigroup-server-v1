import mongoose, { Schema } from 'mongoose'

// Định nghĩa Schema cho mỗi mục cập nhật tiến độ (ProgressEntry)
const ProgressEntrySchema = new Schema(
  {
    // Liên kết tới dự án (nếu bạn muốn lưu luôn thông tin dự án liên quan)
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    // Ngày cập nhật tiến độ
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Mô tả hoặc ghi chú tiến độ trong ngày
    description: {
      type: String,
      trim: true,
    },
    // (Tùy chọn) Mảng URL hoặc tên file của các hình ảnh liên quan đến tiến độ
    imageUrls: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  },
)

// Xuất model để sử dụng trong hệ thống
export default mongoose.model('ProgressEntry', ProgressEntrySchema)
