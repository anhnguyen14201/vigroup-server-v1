import mongoose, { Schema } from 'mongoose'

const Product = new Schema(
  {
    translations: [
      {
        language: {
          type: Schema.Types.ObjectId,
          ref: 'Language',
          required: true,
        },
        productName: { type: String },
        shortDesc: { type: String },
        desc: { type: String },
        specifications: { type: String },
        slug: { type: String, unique: true, trim: true },
        metaDescription: { type: String, default: '', trim: true },
      },
    ],
    code: { type: String, unique: true, required: true, trim: true },
    categoryIds: {
      type: Schema.Types.ObjectId,
      ref: 'ProductCategory',
      default: null,
    },
    brandIds: {
      type: Schema.Types.ObjectId,
      ref: 'ProductBrand',
      default: null,
    },
    price: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 21 },
    quantity: { type: Number, default: 0 },
    sold: { type: Number, default: 0 },

    // Persisted field stored in DB
    stockStatus: { type: String, default: 'In Stock' },

    thumbnailUrls: [String],
    imageUrls: [String],
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
  },
  { versionKey: false, timestamps: true },
)

// Pre-save hook to update stockStatus field each time before saving
Product.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any
  if (update.quantity !== undefined) {
    const qty = update.quantity
    let newStatus = 'In Stock'
    if (qty <= 0) newStatus = 'Out of Stock'
    else if (qty < 10) newStatus = 'Low Stock'
    // Gán thêm vào câu lệnh update
    this.setUpdate({
      ...update,
      stockStatus: newStatus,
    })
  }
  next()
})

export default mongoose.model('Product', Product)
