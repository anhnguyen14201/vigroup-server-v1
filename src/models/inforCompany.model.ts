import mongoose, { Schema } from 'mongoose'

const InforCompanySchema = new Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    ico: {
      type: String,
      required: true,
      trim: true,
    },

    dic: {
      type: String,
      required: true,
      trim: true,
    },

    bankAccount: {
      type: String,
      required: true,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    imageUrls: {
      type: [String],
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

export default mongoose.model('InforCompany', InforCompanySchema)
