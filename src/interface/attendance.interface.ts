import { Schema, Types } from 'mongoose'

// Interface cho từng ca làm việc (shifts)
interface IShift extends Document {
  projectId: Types.ObjectId // Dự án liên quan
  notes?: string // Ghi chú (không bắt buộc)
  checkIn: Date // Giờ vào
  checkOut?: Date // Giờ ra (có thể không có)
  shift: 'morning' | 'evening' // Loại ca làm việc
  totalShiftHours?: number // Tổng số giờ làm trong ca
}

// Interface chính cho Attendance
interface IAttendance extends Document {
  employeeId: Types.ObjectId // Nhân viên liên quan
  projectId: Types.ObjectId // Dự án liên quan
  date: Date // Ngày chấm công
  totalHours?: number // Tổng số giờ làm trong ngày
  hourlyRate?: number // Mức lương theo giờ
  salary?: number // Tổng lương
  shifts: IShift[] // Danh sách ca làm việc
}

export { IAttendance, IShift }
