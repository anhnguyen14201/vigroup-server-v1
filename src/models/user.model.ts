import mongoose, { Schema } from 'mongoose'
import crypto from 'crypto'
import { IUser } from '~/interface/user.interface.js'

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      unique: true,
      sparse: true, // Cho phép giá trị null mà không gây lỗi duy nhất
      // không bắt buộc (required) vì có thể đăng ký bằng số điện thoại
    },

    phone: {
      type: String,
      unique: true,
      sparse: true, // Tương tự như email
      // không bắt buộc (required)
    },

    password: {
      type: String,
      required: function () {
        return !this.facebookId
      },
    },

    companyName: {
      type: String,
      trim: true,
    },
    dic: {
      type: String,
      trim: true,
    },
    ico: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    street: {
      type: String,
      trim: true,
    },
    province: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },

    role: {
      type: Number,
      enum: [3515, 1413914, 1311417518, 5131612152555, 32119201513518],
      default: 32119201513518,
    },

    position: {
      type: String,
      trim: true,
    },

    refreshTokens: [{ token: String, createdAt: Date }],

    isBlock: {
      type: Boolean,
      default: false,
    },

    facebookId: {
      type: String,
      trim: true,
    },

    projects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
      },
    ],

    carts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart',
      },
    ],

    hourlyRate: {
      type: Number,
      trim: true,
    },
    attendances: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance',
      },
    ],
    passwordChangedAt: {
      type: String,
    },

    passwordResetToken: {
      type: String,
    },

    passwordResetExpires: {
      type: String,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

// Pre-validate hook để đảm bảo ít nhất có một trong hai (email hoặc phone) được cung cấp
userSchema.pre<IUser>('validate', function (next) {
  // Nếu không có facebookId, thì yêu cầu phải có email hoặc phone
  if (!this.facebookId && !this.email && !this.phone) {
    next(new Error('Vui lòng cung cấp số điện thoại hoặc email.'))
  } else {
    next()
  }
})

userSchema.methods = {
  createPasswordChangedToken: function () {
    const resetToken = crypto.randomBytes(32).toString('hex')
    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex')
    this.passwordResetExpires = Date.now() + 5 * 60 * 1000
    return resetToken
  },
}

export default mongoose.model<IUser>('User', userSchema)
