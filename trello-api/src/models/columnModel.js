/**
 * Updated by Xuanthe's author on December 14 2024
 */

import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Define Collection (name & schema)
const COLUMN_COLLECTION_NAME = 'columns'
const COLUMN_COLLECTION_SCHEMA = Joi.object({
  // boardId: Định nghĩa kiểu OBJECT_ID_RULE trong ~/utils/validations.js
  boardId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  title: Joi.string().required().min(3).max(50).trim().strict(),

  // Lưu ý: các item trong mảng cardOrderIds là ObjectId nên cần thêm pattern cho chuẩn
  cardOrderIds: Joi.array().items(Joi.string().pattern(OBJECT_ID_RULE)
    .message(OBJECT_ID_RULE_MESSAGE))
    .default([]),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields mà chúng ta không muốn cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'boardId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await COLUMN_COLLECTION_SCHEMA.validateAsync(data, {
    abortEarly: false
  })
}

const createNew = async (data) => {
  try {
    // Kiểm tra data một lần nữa để đẩy vào DB
    const validData = await validateBeforeCreate(data)

    // Ghi đè ngược lại giá trị boardId của validData để chuyển về ObjectId
    const newColumnToAdd = {
      ...validData,
      boardId: new ObjectId(validData.boardId)
    }

    const createdColumn = await GET_DB().collection(COLUMN_COLLECTION_NAME).insertOne(newColumnToAdd)
    return createdColumn
  } catch (error) {
    throw new Error(error)
  }
}

const fineOneById = async (id) => {
  try {
    // Cần phải parse kiểu dữ liệu của id sang ObjectId() thì MongoDB mới trả về kết quả đúng
    const result = await GET_DB()
      .collection(COLUMN_COLLECTION_NAME)
      .findOne({
        _id: new ObjectId(id)
      })
    return result
  } catch (error) {
    throw new Error(error)
  }
}

// Nhiệm vụ của function này là push một giá trị cardId vào cuối mảng cardOrderIds
const pushCardOrderIds = async (card) => {
  try {

    const result = await GET_DB().collection(COLUMN_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(card.columnId) },
      // Đẩy giá trị card._id (Ép sang kiểu ObjectId) vào cuối mảng cardOrderIds
      { $push: { cardOrderIds: new ObjectId(card._id) } },
      // returnDocument nhận giá trị: 'after': trả về bản ghi sau khi cập nhật,
      // 'before': bản ghi trước khi cập nhật
      { returnDocument: 'after' }
    )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

// Nhiệm vụ của function này là cập nhật bản ghi board sau khi kéo thả
const update = async (columnId, updateData) => {
  try {
    // Lấy ra các key từ updateData
    Object.keys(updateData).forEach(fieldName => {
      // Lọc những fields không cho phép cập nhật linh tinh
      // Nếu FE có gửi lên các fields không được phép update thì BE sẽ tiến hành xóa
      if (INVALID_UPDATE_FIELDS.includes(fieldName)) {
        delete updateData[fieldName]
      }
    })

    // Đối với những dữ liệu liên quan đến ObjectId, cần biến đổi ở đây
    if (updateData.cardOrderIds) {
      updateData.cardOrderIds = updateData.cardOrderIds.map(_id => (new ObjectId(_id)))
    }

    const result = await GET_DB().collection(COLUMN_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(columnId) },
      { $set: updateData },
      { returnDocument: 'after' }
    )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const deleteOneById = async (columnId) => {
  try {
    // Cần phải parse kiểu dữ liệu của id sang ObjectId() thì MongoDB mới trả về kết quả đúng
    const result = await GET_DB().collection(COLUMN_COLLECTION_NAME).deleteOne({
      _id: new ObjectId(columnId)
    })

    return result
  } catch (error) {
    throw new Error(error)
  }
}

export const columnModel = {
  COLUMN_COLLECTION_NAME,
  COLUMN_COLLECTION_SCHEMA,
  createNew,
  fineOneById,
  pushCardOrderIds,
  update,
  deleteOneById
}
