import mongoose from 'mongoose'
const { Schema } = mongoose

const seoSchema = new Schema(
  {
    // Dành cho trang tĩnh (ví dụ: 'home', 'about', 'contact')
    page: {
      type: String,
      required: function () {
        return !this.refModel
      },
      unique: true,
      trim: true,
    },

    // Dành cho document động (Project, Product, Service)
    refModel: {
      type: String,
      enum: ['Project', 'Product', 'Service'],
      required: function (this: any) {
        return !this.page
      },
    },

    refId: {
      type: Schema.Types.ObjectId,
      refPath: 'refModel',
      required: function (this: any) {
        return !this.page
      },
    },

    // Các field chung cho cả trang tĩnh và document động
    title: { type: String, required: true },

    description: { type: String },

    keywords: { type: [String], default: [] },

    og: {
      title: String,
      description: String,
      image: String,
    },

    canonical: String,

    active: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Tạo index nhằm đảm bảo tính duy nhất:
// - Nếu sử dụng field "page", thì giá trị phải là duy nhất.
// - Nếu sử dụng cặp (refModel, refId), cặp đó cũng phải là duy nhất.
seoSchema.index(
  { page: 1 },
  {
    unique: true,
    partialFilterExpression: { page: { $exists: true } },
  },
)
seoSchema.index(
  { refModel: 1, refId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      refModel: { $exists: true },
      refId: { $exists: true },
    },
  },
)

export default mongoose.model('Seo', seoSchema)
