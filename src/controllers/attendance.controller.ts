import expressAsyncHandler from 'express-async-handler'
import mongoose from 'mongoose'
import { Attendance, Project, User } from '~/models/index.js'
import { calculateTotalHours } from '~/utils/index.js'

// Utility to parse and validate month/year query params
function parseMonthYear(query: any) {
  const month = parseInt(query.month, 10)
  const year = parseInt(query.year, 10)
  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return null
  }
  return { month, year }
}

export const createAttendance = expressAsyncHandler(async (req, res) => {
  const { employeeId, projectId, date, hourlyRate, shifts } = req.body

  if (!Array.isArray(shifts) || shifts.length === 0) {
    res.status(400).json({ success: false, message: 'Shifts are required.' })
    return
  }

  // Create attendance record
  const attendance = await Attendance.create({
    employeeId,
    projectId,
    date,
    hourlyRate,
    shifts,
  })

  // Update employee's attendance references
  const employee = await User.findByIdAndUpdate(
    employeeId,
    { $addToSet: { attendance: attendance._id } },
    { new: true },
  )
  if (!employee) throw new Error('Employee update failed')

  // Add employee to project if not present
  await Project.updateOne(
    { _id: projectId },
    { $addToSet: { employees: employeeId } },
  )

  res.status(201).json({ success: true, data: attendance })
})

// PUT /api/attendance/:attendanceId
export const updateAttendance = expressAsyncHandler(async (req, res) => {
  const { attendanceId } = req.params
  const { shifts } = req.body

  // 1) Validate input
  if (!Array.isArray(shifts) || shifts.length === 0) {
    res.status(400).json({
      success: false,
      message: 'Shifts array is required and cannot be empty.',
    })
    return
  }

  // 2) Fetch Attendance record
  const attendance = await Attendance.findById(attendanceId)
  if (!attendance) {
    res.status(404).json({
      success: false,
      message: 'Attendance not found.',
    })
    return
  }

  // 3) Process shifts
  shifts.forEach(shift => {
    const { checkIn, checkOut, projectId, notes, shift: shiftType } = shift

    // Only add if checkOut is provided
    if (checkIn && checkOut) {
      const hours = calculateTotalHours(new Date(checkIn), new Date(checkOut))

      attendance.shifts.push({
        projectId,
        notes,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        shift: shiftType,
        totalShiftHours: hours,
      })
    }
  })

  // 4) Sync totalHours & salary via pre-save hook in model,
  //    then save attendance
  const updated = await attendance.save()

  // 5) Update related Employee document
  await User.findByIdAndUpdate(
    attendance.employeeId,
    { $addToSet: { attendance: attendance._id } },
    { new: true },
  )

  // 6) Ensure each project has this employee in its list
  const projectIds = [...new Set(shifts.map(s => s.projectId))]
  await Promise.all(
    projectIds.map(pid =>
      Project.updateOne(
        { _id: pid },
        { $addToSet: { employees: attendance.employeeId } },
      ),
    ),
  )

  // 7) Respond with updated attendance
  res.status(200).json({ success: true, data: updated })
})

/**
 * GET /api/attendance/summary?month=MM&year=YYYY
 * Trả về tổng hợp công việc trong tháng của nhân viên
 */
export const getMonthlySummary = expressAsyncHandler(async (req, res) => {
  const params = parseMonthYear(req.query)
  if (!params) {
    res.status(400).json({ success: false, message: 'Invalid month or year.' })
    return
  }
  const { month, year } = params
  const employeeId = req.user?._id

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  const records = await Attendance.find({
    employeeId,
    date: { $gte: start, $lt: end },
  })

  let totalHours = 0
  let totalSalary = 0
  const workedDates = new Set<string>()

  records.forEach(r => {
    totalHours += r.totalHours || 0
    totalSalary += r.salary || 0
    if (r.shifts.some(s => s.checkIn && s.checkOut)) {
      workedDates.add(r.date.toISOString().slice(0, 10))
    }
  })

  const workedDays = workedDates.size
  const averageHoursPerDay =
    workedDays > 0 ? parseFloat((totalHours / workedDays).toFixed(2)) : 0
  const employee = await User.findById(employeeId).select('fullName')

  res.json({
    success: true,
    data: {
      employeeId,
      fullName: employee?.fullName,
      totalHours: parseFloat(totalHours.toFixed(2)),
      totalSalary: parseFloat(totalSalary.toFixed(2)),
      workedDays,
      averageHoursPerDay,
    },
  })
})

/**
 * GET /api/attendance/monthly-summary?month=MM&year=YYYY
 * Trả về báo cáo tổng hợp cho tất cả nhân viên
 */
export const monthlySummary = expressAsyncHandler(
  async (req: any, res: any) => {
    // 1. Parse tháng & năm
    const params = parseMonthYear(req.query)
    if (!params) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid month or year.' })
    }
    const { month, year } = params
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)

    // 2. Build user filter: loại bỏ role mặc định và search
    const defaultRole = 32119201513518
    const userFilter: any = { role: { $ne: defaultRole } }
    if (
      typeof req.query.searchTerm === 'string' &&
      req.query.searchTerm.trim()
    ) {
      const kw = req.query.searchTerm.trim()
      userFilter.$or = [
        { fullName: { $regex: kw, $options: 'i' } },
        { email: { $regex: kw, $options: 'i' } },
        { phone: { $regex: kw, $options: 'i' } },
      ]
    }

    // 3. Phân trang: đọc page & limit từ query
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
    const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 10)
    const skip = (page - 1) * limit

    // 4. Lấy danh sách users đã filter (để đếm tổng) và attendance trong tháng
    const [allUsers, attendances] = await Promise.all([
      User.find(userFilter).lean(),
      Attendance.find({ date: { $gte: start, $lt: end } }).lean(),
    ])

    const totalItems = allUsers.length
    const totalPages = Math.ceil(totalItems / limit)

    // 5. Chỉ lấy users của page hiện tại
    const employees = allUsers.slice(skip, skip + limit)

    // 6. Group attendances theo employeeId
    const byEmp = new Map<string, typeof attendances>()
    attendances.forEach(a => {
      const key = a.employeeId.toString()
      if (!byEmp.has(key)) byEmp.set(key, [])
      byEmp.get(key)!.push(a)
    })

    // 7. Gom projectIds & query 1 lần
    const allProjectIds = new Set<string>()
    byEmp.forEach(records =>
      records.forEach(r =>
        r.shifts.forEach(s => allProjectIds.add(s.projectId.toString())),
      ),
    )
    const projects = await Project.find({
      _id: { $in: Array.from(allProjectIds) },
    }).lean()
    const projectMap = new Map(projects.map(p => [p._id.toString(), p]))

    // 8. Tính summary cho mỗi employee
    const data = employees.map(emp => {
      const empId = emp._id.toString()
      const records = byEmp.get(empId) || []

      let totalHours = 0
      let totalSalary = 0
      const days = new Set<string>()
      const projSet = new Set<string>()

      records.forEach(a => {
        totalHours += a.totalHours || 0
        totalSalary += a.salary || 0
        if (a.shifts.some(s => s.checkIn && s.checkOut)) {
          days.add(a.date.toISOString().slice(0, 10))
        }
        a.shifts.forEach(s => projSet.add(s.projectId.toString()))
      })

      const totalWorkedDays = days.size
      const averageHoursPerDay = totalWorkedDays
        ? parseFloat((totalHours / totalWorkedDays).toFixed(2))
        : 0
      const empProjects = Array.from(projSet)
        .map(id => projectMap.get(id))
        .filter(Boolean)

      return {
        employeeId: emp._id.toString(),
        fullName: emp.fullName,
        phone: emp.phone,
        email: emp.email,
        street: emp.street,
        province: emp.province,
        postalCode: emp.postalCode,
        position: emp.position,
        role: emp.role,
        hourlyRate: emp.hourlyRate,
        totalWorkedDays,
        totalHours: parseFloat(totalHours.toFixed(2)),
        averageHoursPerDay,
        totalSalary: parseFloat(totalSalary.toFixed(2)),
        totalProjects: empProjects.length,
        projects: empProjects,
      }
    })

    // 9. Trả về kết quả phân trang
    const result = {
      data,
      totalItems,
      totalPages,
    }
    res.json(result)
  },
)
/**
 * GET /api/attendance/by-date?employeeId=&date=YYYY-MM-DD
 * Lấy bản ghi chấm công của nhân viên theo ngày
 */
export const getAttendanceByDate = expressAsyncHandler(async (req, res) => {
  const employeeId = req.query.employeeId as string
  const dateParam = req.query.date as string

  if (!employeeId || !dateParam) {
    res
      .status(400)
      .json({ success: false, message: 'employeeId và date là bắt buộc.' })
    return
  }

  const parsedDate = new Date(dateParam)
  if (isNaN(parsedDate.getTime())) {
    res.status(400).json({
      success: false,
      message: 'Định dạng ngày không hợp lệ. YYYY-MM-DD',
    })
    return
  }

  const start = new Date(parsedDate.setHours(0, 0, 0, 0))
  const end = new Date(parsedDate.setHours(23, 59, 59, 999))

  const attendance = await Attendance.findOne({
    employeeId,
    date: { $gte: start, $lte: end },
  }).lean()

  res.status(200).json({ success: true, data: attendance })
})

export const getAttendancesByMonth = expressAsyncHandler(
  async (req: any, res: any) => {
    const employeeId = req.query.employeeId as string
    const monthParam = req.query.month as string // ví dụ: '2025-08'

    if (!employeeId || !monthParam) {
      return res.status(400).json({
        success: false,
        message: 'employeeId và month là bắt buộc. Ví dụ month=2025-08',
      })
    }

    // parse monthParam thành năm và tháng
    const [yearStr, monthStr] = monthParam.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10) - 1 // JS Date tháng 0–11

    if (isNaN(year) || isNaN(month) || month < 0 || month > 11 || year < 1970) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng tháng không hợp lệ. Đúng: YYYY-MM, ví dụ 2025-08',
      })
    }

    // Xác định ngày đầu/tháng cuối
    const start = new Date(year, month, 1, 0, 0, 0, 0)
    // Tháng tiếp theo trừ 1ms
    const end = new Date(year, month + 1, 1, 0, 0, 0, 0)
    end.setMilliseconds(end.getMilliseconds() - 1)

    // Query MongoDB
    const attendances = await Attendance.find({
      employeeId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .lean()

    res.status(200).json({ success: true, data: attendances })
  },
)

/**
 * PUT /api/attendance/update-by-date
 * Cập nhật shifts trong attendance theo ngày
 */
export const updateAttendanceByDate = expressAsyncHandler(
  async (req: any, res: any) => {
    const { _id, shifts } = req.body

    if (!_id || !Array.isArray(shifts)) {
      res.status(400).json({
        success: false,
        message: 'Attendance ID và shifts là bắt buộc.',
      })
      return
    }

    const attendance = await Attendance.findById(_id)
    if (!attendance) {
      res
        .status(404)
        .json({ success: false, message: 'Attendance không tồn tại.' })
      return
    }

    let totalHours = 0
    let totalSalary = 0

    const updatedShifts = shifts.map(shift => {
      const { checkIn, checkOut, projectId, notes, shift: shiftType } = shift
      let hours = 0
      if (checkIn && checkOut) {
        hours = parseFloat(
          calculateTotalHours(new Date(checkIn), new Date(checkOut)).toFixed(2),
        )
      }

      totalHours += hours
      totalSalary += parseFloat(
        (hours * (attendance.hourlyRate || 0)).toFixed(2),
      )
      return {
        projectId,
        notes,
        checkIn,
        checkOut,
        shift: shiftType,
        totalShiftHours: parseFloat(hours.toFixed(2)),
      }
    })

    attendance.set({
      shifts: updatedShifts,
      totalHours: parseFloat(totalHours.toFixed(2)),
      salary: parseFloat(totalSalary.toFixed(2)),
    })

    const updated = await attendance.save()
    res.status(200).json({ success: true, data: updated })
  },
)

export const getAttendanceByProjectAndEmployees = expressAsyncHandler(
  async (req, res) => {
    const projectId = req.query.projectId as string
    let employeeIds = req.query.employeeIds as string | string[] | undefined

    /*    if (!projectId || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Cần truyền projectId và mảng employeeIds.',
      })
      return
    } */

    if (!Array.isArray(employeeIds)) {
      employeeIds =
        typeof employeeIds === 'string' ? employeeIds.split(',') : []
    }

    const validIds = employeeIds.filter(id =>
      mongoose.Types.ObjectId.isValid(id),
    )

    // Tìm tất cả các bản ghi chấm công theo dự án và employeeIds
    const attendanceRecords = await Attendance.find({
      projectId,
      employeeId: { $in: employeeIds },
    }).lean()

    // Gom nhóm theo employeeId
    const groupedByEmployee: { [key: string]: any[] } = {}
    for (const record of attendanceRecords) {
      const empId = record.employeeId.toString()
      if (!groupedByEmployee[empId]) {
        groupedByEmployee[empId] = []
      }
      groupedByEmployee[empId].push(record)
    }

    res.status(200).json({
      success: true,
      data: groupedByEmployee,
    })
  },
)
