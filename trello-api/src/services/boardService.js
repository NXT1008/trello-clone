/**
 * Updated by Xuanthe's author on December 14 2024
 */

import { slugify } from '~/utils/formatters'
import { boardModel } from '~/models/boardModel'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import { cloneDeep } from 'lodash'
import { columnModel } from '~/models/columnModel'
import { cardModel } from '~/models/cardModel'
import { DEFAULT_ITEMS_PER_PAGE, DEFAULT_PAGE } from '~/utils/constants'

const createNew = async (userId, reqBody) => {
  try {
    // Xử lý logic dữ liệu
    const newBoard = {
      ...reqBody,
      // convert chuỗi tring có dấu thành không dấu. vd: Nguyễn Xuân Thể => Nguyen-Xuan-The
      slug: slugify(reqBody.title)
    }

    // Gọi tới tầng Model để xử lý lưu bản ghi newBoard vào Database
    const createdBoard = await boardModel.createNew(userId, newBoard)

    // Lấy bản ghi board sau khi tạo
    // createBoard sẽ trả về Object:
    // { "acknowledged": true, "insertedId": "675d32af9462c0d71e607b81" }

    const getNewBoard = await boardModel.findOneById(createdBoard.insertedId)

    // Làm thêm logic khác với các Collection khác ...vv
    // Bắn email, notification về cho admin khi có 1 cái board mới được tạo ...vv

    // Trả kết quả về cho Controller, LUÔN PHẢI CÓ RETURN
    return getNewBoard
  } catch (error) {
    // Không cần next(error) bởi vì ở controller đã có next() bắt lỗi, rồi lỗi sẽ được xử lý ở middleware
    throw error
  }
}

const getDetails = async (userId, boardId) => {
  try {
    const boardDetails = await boardModel.getDetails(userId, boardId)
    if (!boardDetails) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found!')
    }

    // Xử lý dữ liệu trả về cho khớp với dữ liệu trong mock-data ở FE
    // Sử dụng CloneDeep để tạo ra 1 cái mới, không ảnh hưởng đến cái ban đầu
    // https://www.javascripttutorial.net/javascript-primitive-vs-reference-values/
    const responseBoard = cloneDeep(boardDetails)

    // Dữ liệu ở boardModel trả về mảng Cards cùng cấp với mảng Columns, cần chuyển mảng card của
    // column nào sẽ nằm trong column đó
    responseBoard.columns.forEach((column) => {
      // Lọc mảng cards với điều kiện card.columnId = column._id và gán mảng filter trả về
      // vào mảng cards của column

      column.cards = responseBoard.cards.filter(
        // Phải xử lý việc tìm kiếm vì kiểu dữ liệu của card.columnId = column._id
        // đều là ObjectId

        // Cách 1: Convert ObjectId sang string bằng hàm toString (javascript)
        // (card) => card.columnId.toString() === column._id.toString()

        // Cách 2: Sử dụng hàm equals (MongoDB có support hàm equals của ObjectId)
        (card) => card.columnId.equals(column._id)
      )
    })

    // Không cần mảng cards nữa vì đã gán vào trong column rồi
    delete responseBoard.cards

    return responseBoard
  } catch (error) {
    // Không cần next(error) bởi vì ở controller đã có next() bắt lỗi, rồi lỗi sẽ được xử lý ở middleware
    throw error
  }
}

const update = async (boardId, reqBody) => {
  try {
    const updateData = {
      ...reqBody,
      updatedAt: Date.now()
    }
    const updatedBoard = await boardModel.update(boardId, updateData)
    return updatedBoard
  } catch (error) {
    // Không cần next(error) bởi vì ở controller đã có next() bắt lỗi, rồi lỗi sẽ được xử lý ở middleware
    throw error
  }
}

const moveCardToDifferentColumn = async (reqBody) => {
  try {
    // B1: Cập nhật mảng cardOrderIds của Column ban đầu chứa nó
    //  (Hiểu bản chất là xóa cái _id của Card ra khỏi mảng)
    await columnModel.update(reqBody.prevColumnId, {
      cardOrderIds: reqBody.prevCardOrderIds,
      updatedAt: Date.now()
    })

    // B2: Cập nhật mảng cardOrderIds của Column tiếp theo
    //  (Hiểu bản chất là thêm _id của Card vào mảng)
    await columnModel.update(reqBody.nextColumnId, {
      cardOrderIds: reqBody.nextCardOrderIds,
      updatedAt: Date.now()
    })

    // B3: Cập nhật lại trường columnId mới của cái Card đã kéo
    await cardModel.update(reqBody.currentCardId, {
      columnId: reqBody.nextColumnId
    })

    return { updateResult: 'Successfully' }
  } catch (error) { throw error }
}

const getBoards = async (userId, page, itemsPerPage, queryFilter) => {
  try {
    // Nếu không tồn tại page hoặc itemsPerPage từ phía FE thì BE sẽ cần phải luôn gán giá trị mặc định
    if (!page) page = DEFAULT_PAGE
    if (!itemsPerPage) itemsPerPage = DEFAULT_ITEMS_PER_PAGE

    // Do các biến trong req.query nó có kiểu là string nên cần parse về Int
    const results = await boardModel.getBoards(
      userId,
      parseInt(page, 10),
      parseInt(itemsPerPage, 10),
      queryFilter
    )

    return results
  } catch (error) { throw error }
}


export const boardService = {
  createNew,
  getDetails,
  update,
  moveCardToDifferentColumn,
  getBoards
}
