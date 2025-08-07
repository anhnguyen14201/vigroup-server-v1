import { Types } from 'mongoose'

export interface IProject {
  _id: string
  code: string
  projectName: string
  location: string
  startDate: Date
  endDate: Date
  status: string
  customerName: string
  email: string
  quotationAmount: number
  additionalCost: string | number
  deposit: number
  totalProject: number
  paymentStatus: string
  timelineContent: string
  description: string
  employees: Types.ObjectId
  customerUser: Types.ObjectId[]
  dailyProgress: Types.ObjectId
  quotes: Types.ObjectId
  variations: Types.ObjectId
  amountPaid: number
  depositAmount: number
  totalAmount: number
  paymentAmounts: number[]
}
