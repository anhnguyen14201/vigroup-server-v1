import mongoose, { Schema } from 'mongoose'

const WARRANY_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
}

const WarrantySchema = new Schema(
  {
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    // status field can remain for indexing/query if desired,
    // but we'll add a virtual for real-time status
    status: {
      type: String,
      enum: Object.values(WARRANY_STATUS),
      default: WARRANY_STATUS.ACTIVE,
      required: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for real-time status
WarrantySchema.virtual('currentStatus').get(function () {
  const now = new Date()
  const end = this.endDate || this.startDate
  return now > end ? WARRANY_STATUS.EXPIRED : WARRANY_STATUS.ACTIVE
})

// Pre-save: tính endDate +1 ngày (cho test), và cập nhật status field
WarrantySchema.pre('save', function (next) {
  const now = new Date()
  /*   if (!this.endDate) {
    const start = this.startDate || now
    const end = new Date(start)
    end.setFullYear(end.getFullYear() + 3)
    this.endDate = end
  }
 */
  if (!this.endDate) {
    const start = this.startDate || new Date()
    const end = new Date(start)
    // Thay vì +3 năm, đổi thành +1 ngày để test
    end.setDate(end.getDate() + 1)
    this.endDate = end
  }

  // Cập nhật trường status (vẫn giữ cho query nhanh)
  this.status =
    now > this.endDate ? WARRANY_STATUS.EXPIRED : WARRANY_STATUS.ACTIVE

  next()
})

export default mongoose.model('Warranty', WarrantySchema)
