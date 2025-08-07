import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: process.env.EMAIL_NAME,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
})

// async..await is not allowed in global scope, must use a wrapper
interface EmailParams {
  email: string;
  html: string;
  subject: string;
}

export const sendEmail = async ({ email, html, subject }: EmailParams) => {
  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: '"VIGROUP" <no-relplydieuhoa@gmail.com>', // sender address
    to: email, // list of receivers
    subject: subject, // Subject line

    html: html, // html body
  })

  return info
}
