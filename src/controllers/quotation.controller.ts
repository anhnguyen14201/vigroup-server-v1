// src/controllers/quotation.controller.ts
import expressAsyncHandler from 'express-async-handler'
import { Project, Quotation } from '~/models'

/**
 * POST /api/quotations
 * Create a new quotation
 */
export const createQuotation = expressAsyncHandler(async (req, res) => {
  const { desc, cost, quantity, currency } = req.body.payload

  const projectId = req.body.projectId
  const quotationType = req.body.quotationType
  if (!desc || cost == null || quantity == null) {
    res
      .status(400)
      .json({ success: false, message: 'desc, cost, quantity are required.' })
    return
  }

  const totalPrice = cost * quantity
  const newQuotation = await Quotation.create({
    desc,
    cost,
    quantity,
    currency,
    projectId,
    quotationType,
    totalPrice,
  })

  const updateProject = await Project.findByIdAndUpdate(projectId, {
    $addToSet: {
      quotes: newQuotation._id,
    },
  })

  if (!updateProject) {
    res.status(400).json({ success: false, message: 'Cập nhật dự án thất bại' })
    return
  }
  await Quotation.updateProjectTotals(projectId.toString())

  res.status(201).json({ success: true, data: newQuotation })
})

/**
 * GET /api/quotations
 * Get all quotations
 */
export const getAllQuotations = expressAsyncHandler(async (req, res) => {
  // 1. Xác định loại cần lấy: 'quotation' hoặc 'variation'
  const type = (req.query.type as string) || 'quotation'
  const filter = { quotationType: type }

  // 2. Lấy tất cả dữ liệu, sắp xếp theo mới nhất trước
  const data = await Quotation.find(filter).sort({ createdAt: -1 })

  // 3. Trả về kết quả
  res.status(200).json({
    success: true,
    totalCount: data.length,
    data,
  })
})

/**
 * GET /api/quotations/:id
 * Get a single quotation by ID
 */
export const getQuotationById = expressAsyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id)
  if (!quotation) {
    res.status(404).json({ success: false, message: 'Quotation not found.' })
    return
  }
  res.status(200).json({ success: true, data: quotation })
})

/**
 * PUT /api/quotations/:id
 * Update a quotation by ID
 */
export const updateQuotation = expressAsyncHandler(async (req, res) => {
  const { desc, cost, quantity, currency, quoteDate, projectId } = req.body
  const { quotationId } = req.params
  const totalPrice = cost * quantity

  const updated = await Quotation.findByIdAndUpdate(
    quotationId,
    { desc, cost, quantity, currency, quoteDate, totalPrice, projectId },
    { new: true, runValidators: true },
  )

  if (!updated) {
    res.status(404).json({ success: false, message: 'Quotation not found.' })
    return
  }

  await Quotation.updateProjectTotals(projectId.toString())

  res.status(200).json({ success: true, data: updated })
})

/**
 * DELETE /api/quotations/:id
 * Delete a quotation by ID
 */
export const deleteQuotation = expressAsyncHandler(async (req, res) => {
  const deleted = await Quotation.findByIdAndDelete(req.params.quotationId)
  if (!deleted) {
    res.status(404).json({ success: false, message: 'Quotation not found.' })
    return
  }

  const projectId = deleted.projectId
  if (!projectId) {
    res.status(400).json({
      success: false,
      message: 'Deleted quotation has no associated project.',
    })
    return
  }

  await Project.findByIdAndUpdate(
    projectId,
    { $pull: { quotes: deleted._id } },
    { new: true },
  )
  await Quotation.updateProjectTotals(projectId.toString())

  res.status(200).json({ success: true, message: 'Quotation deleted.' })
})
