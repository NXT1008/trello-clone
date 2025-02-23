/**
 * Updated by Xuanthe's author on December 14 2024
 */

import { StatusCodes } from 'http-status-codes'
import { boardModel } from '~/models/boardModel'
import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import ApiError from '~/utils/ApiError'

const createNew = async (reqBody) => {
  try {
    // Xử lý logic dữ liệu
    const newColumn = {
      ...reqBody
    }
    const createdColumn = await columnModel.createNew(newColumn)
    const getNewColumn = await columnModel.fineOneById(createdColumn.insertedId)

    //
    if (getNewColumn) {
      // Xử lý cấu trúc data ở đây trước khi trả dữ liệu về
      // (Giống với cấu trúc trong mock-data ở FE)
      getNewColumn.cards = []

      // Cập nhật lại mảng columnOrderIds trong collection Boards
      await boardModel.pushColumnOrderIds(getNewColumn)
    }

    return getNewColumn
  } catch (error) { throw error }
}

const update = async (columnId, reqBody) => {
  try {
    const updateData = {
      ...reqBody,
      updatedAt: Date.now()
    }
    const updatedColumn = await columnModel.update(columnId, updateData)

    return updatedColumn
  } catch (error) {
    // Không cần next(error) bởi vì ở controller đã có next() bắt lỗi, rồi lỗi sẽ được xử lý ở middleware
    throw error
  }
}

const deleteItem = async (columnId) => {
  try {

    const targetColumn = await columnModel.fineOneById(columnId)
    if (!targetColumn) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Column not found!')
    }

    // Xóa Column
    await columnModel.deleteOneById(columnId)

    // Xóa toàn bộ Cards thuộc cái Column trên
    await cardModel.deleteManyByColumnId(columnId)

    // Xóa columnId trong mảng columnOrderIds của cái Board chứa nó
    await boardModel.pullColumnOrderIds(targetColumn)

    return { deleteResult: 'Column and its Cards deleted successfully!' }
  } catch (error) {
    // Không cần next(error) bởi vì ở controller đã có next() bắt lỗi, rồi lỗi sẽ được xử lý ở middleware
    throw error
  }
}

export const columnService = {
  createNew,
  update,
  deleteItem
}
