import mongoose, { Schema } from 'mongoose'

const productCategorySchema = new Schema(
  {
    translations: [
      {
        language: {
          type: Schema.Types.ObjectId,
          ref: 'Language',
          required: true,
        },

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

        metaDescription: {
          type: String,
          default: '',
          trim: true,
        },
      },
    ],

    products: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
  },
  { timestamps: true },
)

export default mongoose.model('ProductCategory', productCategorySchema)
