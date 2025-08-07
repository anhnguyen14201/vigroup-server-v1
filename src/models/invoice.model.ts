// src/models/quote.model.ts
import mongoose, { Schema } from 'mongoose'

const InvoiceSchema = new Schema(
  {
    code: { type: String, unique: true },

    status: {
      type: String,
      enum: ['draft', 'quote', 'invoice'],
      default: 'draft',
    },

    date: {
      type: Date,
      required: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InforCompany',
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    warranty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warranty',
    },

    installations: [
      {
        install: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Installation',
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],

    fuels: [
      {
        type: Object,
      },
    ],

    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],

    totalPrice: {
      type: Number,
      required: true,
    },

    pdfUrl: {
      type: String,
    },
  },
  { versionKey: false, timestamps: true },
)

export default mongoose.model('Invoice', InvoiceSchema)
