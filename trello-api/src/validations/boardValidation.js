/**
 * Updated by Xuanthe's author on December 14 2024
 */

import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { BOARD_TYPES } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

const createNew = async (req, res, next) => {
  const correctCondition = Joi.object({
    /**
     * Mặc định chúng ta không cần phải custom message ở phía BE làm gì vì để cho Front-end
     * tự validate và custom message phía FE cho đẹp.
     * Back-end chỉ cần validate Đảm Bảo Dữ Liệu Chuẩn Xác, và trả về message mặc định từ thư viện là được.
     * Quan trọng: Việc Validate dữ liệu BẮT BUỘC phải có ở phía Back-end
     * vì đây là điểm cuối để lưu trữ dữ liệu vào Database.
     * Và thông thường trong thực tế, điều tốt nhất cho hệ thống là hãy luôn validate dữ liệu
     * ở cả Back-end và Front-end.
     */
    title: Joi.string().required().min(3).max(50).trim().strict().messages({
      'any.required': 'Title is required (xuanthedev)',
      'string.empty': 'Title is not allowed to be empty (xuanthedev)',
      'string.min':
        'Title length must be at least 3 characters long (xuanthedev)',
      'string.max':
        'Title length must be less than or equal to 50 characters long (xuanthedev)',
      'string.trim':
        'Title must not have leading or trailing whitespace (xuanthedev)'
    }),
    description: Joi.string().required().min(3).max(256).trim().strict(),
    type: Joi.string().valid(BOARD_TYPES.PUBLIC, BOARD_TYPES.PRIVATE).required()
  })

  try {
    // Kiểm tra dữ liệu phía FE gửi lên có đúng với cấu trúc của correctCondition
    // đã định nghĩa ở trên không
    // abortEarly: true, dừng xác thực ở lỗi đầu tiên
    // nếu false thì trả về tất cả các lỗi được tìm thấy
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    // Nếu req hợp lệ thì next() sẽ cho phép req đi tiếp
    // Ở bên boardRoute đã định nghĩa 2 hàm trong method POST, Validate dữ liệu hợp lệ thì
    // cho request đi tiếp sang controller
    next()
  } catch (error) {
    // Tạo một ApiError mới gồm StatusCode và Messages
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

const update = async (req, res, next) => {
  // Không dùng hàm required() trong trường hợp update
  const correctCondition = Joi.object({
    title: Joi.string().min(3).max(50).trim().strict(),
    description: Joi.string().min(3).max(256).trim().strict(),
    type: Joi.string().valid(BOARD_TYPES.PUBLIC, BOARD_TYPES.PRIVATE),
    columnOrderIds: Joi.array()
      .items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE))
  })

  try {

    // Chỉ định abortEarly: false để trường hợp có nhiều lỗi validation thì trả về tất cả lỗi
    // Dối với trường hợp update, cho phép Unknown để không cần đẩy một số fields lên
    // Ở FE khi update board ta có đẩy trường columnOrderIds (Không có trong correctCondition)
    // nên cần gán allowUnknown: true
    await correctCondition.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true
    })

    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

const moveCardToDifferentColumn = async (req, res, next) => {
  // Không dùng hàm required() trong trường hợp update
  const correctCondition = Joi.object({
    // Validate những dữ liệu phía FE gửi lên
    currentCardId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

    prevColumnId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    prevCardOrderIds: Joi.array().required().items(
      Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)),

    nextColumnId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    nextCardOrderIds: Joi.array().required().items(
      Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE))
  })

  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false })

    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const boardValidation = {
  createNew,
  update,
  moveCardToDifferentColumn
}
