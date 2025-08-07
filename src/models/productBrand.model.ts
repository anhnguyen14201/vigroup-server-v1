import mongoose, { Schema } from 'mongoose'

const productBrandSchema = new Schema(
  {
    translations: [
      {
        language: {
          type: Schema.Types.ObjectId,
          ref: 'Language',
          required: true,
        },

        metaDescription: {
          type: String,
          default: '',
          trim: true,
        },
      },
    ],

    name: {
      type: String,
      unique: true,
      trim: true,
    },

    slug: {
      type: String,
      unique: true,
      trim: true,
    },

    products: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
  },

  {
    versionKey: false,
    timestamps: true,
  },
)

export default mongoose.model('ProductBrand', productBrandSchema)
