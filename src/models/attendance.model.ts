// src/models/Attendance.ts
import mongoose from 'mongoose'

// Sub-schema for individual shifts
const ShiftSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Types.ObjectId,
      ref: 'Project',
      required: true,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },

    checkIn: {
      type: Date,
      required: true,
    },

    checkOut: {
      type: Date,
    },

    shift: {
      type: String,
      enum: ['shift1', 'shift2'],
      required: true,
    },

    totalShiftHours: {
      type: Number,
      default: 0,
    },

    dayShiftHourlyRate: {
      type: Number,
      default: 0,
    },
    nightShiftHourlyRate: {
      type: Number,
      default: 0,
    },

    salaryForShift: {
      type: Number,
      default: 0,
    },
  },
  { _id: true },
)

// Main schema for attendance
const AttendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectId: {
      type: mongoose.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    shifts: {
      type: [ShiftSchema],
      default: [],
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    hourlyRate: {
      type: Number,
      default: 0,
    },

    salary: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.model('Attendance', AttendanceSchema)
