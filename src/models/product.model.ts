import mongoose, { Schema } from 'mongoose'

const calcStockStatus = (qty: any) => {
  const n = Number(qty ?? 0)
  if (isNaN(n)) return 'In Stock'
  if (n <= 0) return 'Out of Stock'
  if (n < 10) return 'Low Stock'
  return 'In Stock'
}

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
    stockStatus: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock'],
      default: 'In Stock',
      trim: true,
    },
    thumbnailUrls: [String],
    imageUrls: [String],
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
  },
  { versionKey: false, timestamps: true },
)

Product.pre('save', function (next) {
  // @ts-ignore
  const doc: any = this
  if (doc.isNew || doc.isModified('quantity')) {
    doc.stockStatus = calcStockStatus(doc.quantity)
  }
  next()
})

// Pre-save hook to update stockStatus field each time before saving
Product.pre('findOneAndUpdate', async function (next) {
  try {
    // this is a Query
    const update: any = this.getUpdate() || {}
    let qty: number | undefined

    if (typeof update.quantity !== 'undefined') {
      qty = Number(update.quantity)
    } else if (update.$set && typeof update.$set.quantity !== 'undefined') {
      qty = Number(update.$set.quantity)
    } else if (update.$inc && typeof update.$inc.quantity !== 'undefined') {
      // cần lấy giá trị hiện tại trong DB để cộng $inc
      const docToUpdate: any = await this.model
        .findOne(this.getQuery())
        .select('quantity')
        .lean()
      const currentQty = docToUpdate?.quantity ?? 0
      qty = Number(currentQty) + Number(update.$inc.quantity)
    }

    if (typeof qty !== 'undefined' && !isNaN(qty)) {
      const newStatus = calcStockStatus(qty)
      // đảm bảo dùng $set (không phá các phần update khác)
      const newUpdate = { ...update }
      if (!newUpdate.$set) newUpdate.$set = {}
      newUpdate.$set.stockStatus = newStatus
      this.setUpdate(newUpdate)
    }
    next()
  } catch (err: any) {
    next(err)
  }
})

export default mongoose.model('Product', Product)
