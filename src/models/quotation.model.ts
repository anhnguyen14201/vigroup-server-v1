import mongoose, { Document, Model, Schema, Types } from 'mongoose'
import { Project } from '~/models'

// 1. Định nghĩa interface cho document của Quotation
export interface IQuotation extends Document {
  desc: string
  cost: number
  quantity: number
  currency: number
  quoteDate: Date
  projectId?: Types.ObjectId
  quotationType: 'quotation' | 'variation'
  totalPrice: number
}

// 2. Định nghĩa interface cho model, mở rộng thêm hàm tĩnh updateProjectTotals
export interface IQuotationModel extends Model<IQuotation> {
  updateProjectTotals(projectId: string): Promise<void>
}

// 3. Khai báo Schema cho Quotation
const QuotationSchema = new Schema<IQuotation, IQuotationModel>(
  {
    desc: {
      type: String,
      required: true,
      trim: true,
    },
    cost: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    currency: {
      type: Number,
      enum: [203, 840, 978],
      default: 203,
    },
    quoteDate: {
      type: Date,
      default: () => new Date(),
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    quotationType: {
      type: String,
      enum: ['quotation', 'variation'],
      default: 'quotation',
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
)

// 4. Áp dụng hàm tĩnh updateProjectTotals
QuotationSchema.statics.updateProjectTotals = async function (
  projectId: string,
): Promise<void> {
  const results = await this.aggregate([
    { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
    {
      $group: {
        _id: '$quotationType',
        total: { $sum: '$totalPrice' },
      },
    },
  ])

  let totalQuotationAmount = 0
  let totalVariationAmount = 0

  results.forEach(item => {
    if (item._id === 'quotation') {
      totalQuotationAmount = item.total
    } else if (item._id === 'variation') {
      totalVariationAmount = item.total
    }
  })

  const totalAmount = totalQuotationAmount + totalVariationAmount
  const firstQuotation = await this.findOne({ projectId: projectId })
  const currencyQuotes = firstQuotation?.currency || 203

  await Project.findByIdAndUpdate(projectId, {
    totalQuotationAmount,
    totalVariationAmount,
    totalAmount,
    currencyQuotes,
  })
}

// 5. Tạo và export model với các interface đã khai báo
export default mongoose.model<IQuotation, IQuotationModel>(
  'Quotation',
  QuotationSchema,
)
