// utils/projectTotals.ts
import mongoose from 'mongoose'
import { Project, Quotation } from '~/models'

export async function recalcProjectTotals(projectId: mongoose.Types.ObjectId) {
  const agg = await Quotation.aggregate([
    { $match: { projectId } },
    {
      $group: {
        _id: '$quotationType',
        sum: { $sum: '$totalPrice' },
      },
    },
  ])
  // agg = [ { _id: 'quotation', sum: 123 }, { _id: 'variation', sum: 45 } ]

  let totalQuotationAmount = 0
  let totalVariationAmount = 0
  for (const g of agg) {
    if (g._id === 'quotation') totalQuotationAmount = g.sum
    if (g._id === 'variation') totalVariationAmount = g.sum
  }
  const totalAmount = totalQuotationAmount + totalVariationAmount
  await Project.findByIdAndUpdate(projectId, {
    totalQuotationAmount,
    totalVariationAmount,
    totalAmount,
  })
}
