import mongoose, { Schema } from 'mongoose'

const OrderSchema = new Schema(
  {
    cartItems: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],

    companyInfo: {
      companyName: { type: String, trim: true },
      dic: { type: String, trim: true },
      ico: { type: String, trim: true },
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    personalInfo: {
      street: { type: String, trim: true },
      country: { type: String, trim: true },
      email: { type: String, trim: true },
      fullName: { type: String, trim: true },
      phone: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      province: { type: String, trim: true },
    },

    shippingMethod: {
      type: String,
      required: true,
      enum: ['PICKUP', 'PPL', 'GLS', 'DPD', 'GEIS'],
    },

    status: {
      type: String,
      default: 'Processing',
      enum: ['Cancelled', 'Processing', 'Successed'],
    },

    shippingDate: {
      type: Date,
      default: null,
    },

    total: {
      type: Number,
      trim: true,
    },
    pdfUrl: {
      type: String,
      trim: true,
    },
    shippingCost: {
      type: Number,
      trim: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

export default mongoose.model('Order', OrderSchema)
