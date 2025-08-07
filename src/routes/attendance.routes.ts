import express from 'express'
import {
  createAttendance,
  getAttendanceByDate,
  getAttendanceByProjectAndEmployees,
  getAttendancesByMonth,
  getMonthlySummary,
  monthlySummary,
  updateAttendance,
  updateAttendanceByDate,
} from '~/controllers'
import { authenticate, authorizeRole } from '~/middlewares'

const attendanceRouter = express.Router()

attendanceRouter.post('/', authenticate, createAttendance)
attendanceRouter.get('/', authenticate, getAttendanceByDate)
attendanceRouter.get(
  '/by-project',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  getAttendanceByProjectAndEmployees,
)
attendanceRouter.get(
  '/attendance-by-month/',
  authenticate,
  getAttendancesByMonth,
)

attendanceRouter.get('/my-monthly-summary', getMonthlySummary)
attendanceRouter.get(
  '/monthly-summary',
  authenticate,
  authorizeRole([3515, 1413914, 1311417518]),
  monthlySummary,
)

attendanceRouter.put('/:attendanceId', authenticate, updateAttendanceByDate)
attendanceRouter.put('/:attendanceId', authenticate, updateAttendance)

/* attendanceRouter.post('/login-by-phone', loginByPhone)
attendanceRouter.get('/current', [verifyEmployeeJWT], getEmployee) */

export default attendanceRouter
