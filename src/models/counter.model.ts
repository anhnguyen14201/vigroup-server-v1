import { Schema, model, Document } from 'mongoose'

interface ICounter extends Document {
  name: string // ví dụ 'quote'
  year: number // năm hiện tại
  seq: number // số thứ tự
}

const counterSchema = new Schema<ICounter>({
  name: { type: String, required: true },
  year: { type: Number, required: true },
  seq: { type: Number, required: true, default: 0 },
})

// Index để mỗi (name, year) là độc nhất
counterSchema.index({ name: 1, year: 1 }, { unique: true })

export const Counter = model<ICounter>('Counter', counterSchema)
