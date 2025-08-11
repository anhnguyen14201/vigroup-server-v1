import mongoose, { Schema, Types } from 'mongoose'

// Declare the Schema of the Mongo model
const Project = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
    },

    projectType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectType', // Liên kết đến bảng User
    },

    showProject: {
      type: Boolean,
      default: false,
    },

    kind: {
      type: String,
      enum: ['template', 'project'],
      required: true,
    },

    translations: [
      {
        language: {
          type: Schema.Types.ObjectId,
          ref: 'Language',
          required: true,
        },

        description: {
          type: String,
          trim: true,
        },

        projectName: {
          type: String,
          trim: true,
        },

        buildingType: {
          type: String,
          trim: true,
        },

        slug: {
          type: String,
          unique: true,
          trim: true,
          index: true,
        },

        metaDescription: {
          type: String,
          default: '',
          trim: true,
        },
      },
    ],

    thumbnailUrls: {
      type: [String],
    },

    imageUrls: {
      type: [String],
    },

    location: {
      type: String,
      trim: true,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ['processing', 'started', 'finished', 'cancelled'],
      default: 'processing',
    },

    customerUser: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Liên kết đến bảng User
      },
    ],

    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Liên kết đến bảng User
      },
    ],

    dailyProgress: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProgressEntry',
      },
    ],

    quotes: [
      {
        type: Types.ObjectId,
        ref: 'Quotation',
      },
    ],

    paymentStatus: {
      type: String,
      enum: ['unpaid', 'deposited', 'partial', 'paid', 'processing'],
      default: 'unpaid',
    },

    depositAmount: {
      // Số tiền đặt cọc
      type: Number,
      default: 0,
    },

    totalAmount: {
      // Tổng giá trị dự án
      type: Number,
      default: 0,
    },

    nightShiftPay: {
      // Tổng giá trị dự án
      type: Number,
      default: 0,
    },

    paymentAmounts: {
      // Mảng lưu số tiền theo từng đợt thanh toán
      type: [Number],
      default: [],
    },

    // Trường mới chứa tổng tiền đã thanh toán (chỉ lấy từ paymentAmounts)
    totalPaidAmount: {
      type: Number,
      default: 0,
    },

    totalReceived: {
      type: Number,
      default: 0,
    },

    currencyPayment: {
      type: Number,
      enum: [203, 840, 978],
      default: 203,
    },

    currencyQuotes: {
      type: Number,
      enum: [203, 840, 978],
      default: 203,
    },

    totalQuotationAmount: {
      // Tổng của tất cả báo giá chính
      type: Number,
      default: 0,
    },

    totalVariationAmount: {
      // Tổng của tất cả báo giá variation
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

// Middleware cập nhật totalPaidAmount, totalReceived và paymentStatus tự động
Project.pre('save', function (next) {
  // Đảm bảo các giá trị là số
  const deposit = this.depositAmount || 0
  const paymentsSum = Array.isArray(this.paymentAmounts)
    ? this.paymentAmounts.reduce((acc, v) => acc + v, 0)
    : 0

  // Tổng số tiền nhận được (bao gồm cả đặt cọc)
  const totalReceived = deposit + paymentsSum
  this.totalPaidAmount = paymentsSum
  this.totalReceived = totalReceived

  // Nếu tổngAmount không hợp lệ (ví dụ là 0) -> ta cho mặc định thanh toán đã xong
  if (this.totalAmount <= 0) {
    this.paymentStatus = 'processing'
  }
  // Nếu tiền đặt cọc đã đủ để thanh toán (hoặc vượt quá tổng cần thanh toán)
  else if (deposit >= this.totalAmount) {
    this.paymentStatus = 'paid'
  }
  // Nếu không nhận được khoản nào
  else if (totalReceived <= 0) {
    this.paymentStatus = 'unpaid'
  }
  // Nếu chỉ có tiền đặt cọc mà chưa có khoản thanh toán nào
  else if (deposit > 0 && paymentsSum === 0) {
    this.paymentStatus = 'deposited'
  }
  // Nếu tổng tiền nhận được còn nhỏ hơn tổng giá trị cần thanh toán
  else if (totalReceived < this.totalAmount) {
    this.paymentStatus = 'partial'
  }
  // Nếu tổng nhận được bằng hoặc vượt qua tổng cần thanh toán
  else {
    this.paymentStatus = 'paid'
  }

  next()
})

export default mongoose.model('Project', Project)
