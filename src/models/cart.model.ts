import mongoose, { Schema } from 'mongoose'

const cartItemSchema = new Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  priceSnapshot: {
    type: Number,
    required: true,
  },
})

export default mongoose.model('Cart', cartItemSchema)
