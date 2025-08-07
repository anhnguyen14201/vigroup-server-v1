export interface IInfor extends Document {
  _id: string
  inforType: string
  desc: string
  url: string
  activity: true | false
  createdAt: string
  updatedAt: string
}
