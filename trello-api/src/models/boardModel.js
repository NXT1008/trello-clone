/**
 * Updated by Xuanthe's author on December 14 2024
 */
import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { BOARD_TYPES } from '~/utils/constants'
import { columnModel } from './columnModel'
import { cardModel } from './cardModel'
import { userModel } from './userModel'
import { pagingSkipValue } from '../utils/algorithms'

// Define Collection (name & schema)
const BOARD_COLLECTION_NAME = 'boards'
const BOARD_COLLECTION_SCHEMA = Joi.object({
  title: Joi.string().required().min(3).max(50).trim().strict(),
  slug: Joi.string().required().min(3).trim().strict(),
  description: Joi.string().required().min(3).max(256).trim().strict(),

  /**
   * Tips: Thay vì gọi lần lượt tất cả type của board để cho vào hàm valid() thì có thể
   *  viết gọn lại bằng Object.values() kết hợp Spread Operator của JS.
   *  Cụ thể: .valid(...Object.values(BOARD_TYPES))
   * Làm như trên thì sau này dù các bạn có thêm hay sửa gì vào cái BOARD_TYPES trong file
   *  constants thì ở những chỗ dùng Joi trong Model hay Validation cũng không cần phải đụng vào nữa.
   *  Tối ưu gọn gàng luôn.
  */
  // type: Joi.string().valid(BOARD_TYPES.PUBLIC, BOARD_TYPES.PRIVATE).required(),
  type: Joi.string().required().valid(...Object.values(BOARD_TYPES)),

  // Lưu ý các item trong mảng columnOrderIds là ObjectId nên cần thêm pattern cho chuẩn nhé
  columnOrderIds: Joi.array()
    .items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE))
    .default([]),

  // Những Admin của cái board
  ownerIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),

  // Những thành viên của cái board
  memberIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields mà chúng ta không muốn cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await BOARD_COLLECTION_SCHEMA.validateAsync(data, {
    abortEarly: false
  })
}

const createNew = async (userId, data) => {
  try {
    // Kiểm tra data một lần nữa để đẩy vào DB
    const validData = await validateBeforeCreate(data)
    // Thêm userId vào mảng ownerIds
    const newBoardToAdd = {
      ...validData,
      ownerIds: [new ObjectId(userId)]
    }

    const createdBoard = await GET_DB().collection(BOARD_COLLECTION_NAME).insertOne(newBoardToAdd)
    return createdBoard
  } catch (error) {
    throw new Error(error)
  }
}

const findOneById = async (id) => {
  try {
    // Cần phải parse kiểu dữ liệu của id sang ObjectId() thì MongoDB mới trả về kết quả đúng
    const result = await GET_DB()
      .collection(BOARD_COLLECTION_NAME)
      .findOne({
        _id: new ObjectId(id)
      })
    return result
  } catch (error) {
    throw new Error(error)
  }
}

// Query tổng hợp (Aggregate) để lấy toàn bộ Columns và Cards thuộc về Board
const getDetails = async (userId, boardId) => {
  try {
    // const result = await GET_DB().collection(BOARD_COLLECTION_NAME).findOne({
    //   _id: new ObjectId(id)
    // })

    const queryConditions = [
      { _id: new ObjectId(boardId) },
      { _destroy: false },
      { $or: [
        { ownerIds: { $all: [new ObjectId(userId)] } },
        { memberIds: { $all: [new ObjectId(userId)] } }
      ] }
    ]

    // $match : Điều kiện tìm kiếm (giống như WHERE ở SQL)
    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).aggregate([
      { $match: { $and: queryConditions } },
      { // Join đến bảng column để tìm tất cả column của board
        $lookup: {
          from: columnModel.COLUMN_COLLECTION_NAME,
          localField: '_id', // tên cột id của bảng Board
          foreignField: 'boardId', // tên cột id khóa ngoại của bảng Column (Bảng tham chiếu)
          // Tìm toàn bộ Column có boardId = _id trong Board và trả về mảng "columns" đính kèm vào Board
          as: 'columns'
        }
      },
      { // Join đến bảng Card (boardId) để tìm tất cả Card của board
        $lookup: {
          from: cardModel.CARD_COLLECTION_NAME,
          localField: '_id', // tên cột id của bảng Board
          foreignField: 'boardId', // tên cột id khóa ngoại của bảng Card (Bảng tham chiếu)
          // Tìm toàn bộ Card có boardId = _id trong Board và trả về mảng "columns" đính kèm vào Board
          as: 'cards'
        }
      },
      { // Join đến bảng User để tìm user theo board
        $lookup: {
          from: userModel.USER_COLLECTION_NAME,
          localField: 'ownerIds',
          foreignField: '_id',
          as: 'owners',
          // pipeline trong lookup là để xử lý một hoặc nhiều luồng cần thiết
          // $project để chỉ định vài field không muốn lấy về bằng cách gán nó giá trị 0
          pipeline: [{ $project: { 'password': 0, 'verifyToken': 0 } }]
        }
      },
      {
        $lookup: {
          from: userModel.USER_COLLECTION_NAME,
          localField: 'memberIds',
          foreignField: '_id',
          as: 'members',
          pipeline: [{ $project: { 'password': 0, 'verifyToken': 0 } }]
        }
      }
    ]).toArray()

    // result có dữ liệu thì sẽ trả về mảng có 1 phần tử, ngược lại thì null
    return result[0] || null
  } catch (error) {
    throw new Error(error)
  }
}

// Nhiệm vụ của function này là push một giá trị columnId vào cuối mảng columnOrderIds
// Dùng toán tử $push trong mongodb để đẩy 1 phần tử vào cuối mảng
const pushColumnOrderIds = async (column) => {
  try {

    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(column.boardId) },
      // Đẩy giá trị column._id (Ép sang kiểu ObjectId) vào cuối mảng columnOrderIds
      { $push: { columnOrderIds: new ObjectId(column._id) } },
      // returnDocument nhận giá trị: 'after': trả về bản ghi sau khi cập nhật,
      // 'before': bản ghi trước khi cập nhật
      { returnDocument: 'after' }
    )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

// Nhiệm vụ của function này là lấy phần tử ColumnId ra khỏi mảng columnOrderIds
// Dùng toán tử $pull trong mongodb để lấy 1 phần tử ra khỏi mảng rồi xóa nó đi
const pullColumnOrderIds = async (column) => {
  try {

    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(column.boardId) },
      // Đẩy giá trị column._id (Ép sang kiểu ObjectId) vào cuối mảng columnOrderIds
      { $pull: { columnOrderIds: new ObjectId(column._id) } },
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
const update = async (boardId, updateData) => {
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
    // Cập nhật lại mảng columnOrderIds có kiểu dữ liệu là ObjectId
    if (updateData.columnOrderIds) {
      updateData.columnOrderIds = updateData.columnOrderIds.map(_id => (new ObjectId(_id)))
    }

    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(boardId) },
      // Đẩy giá trị column._id (Ép sang kiểu ObjectId) vào cuối mảng columnOrderIds
      { $set: updateData },
      // returnDocument nhận giá trị: 'after': trả về bản ghi sau khi cập nhật,
      // 'before': bản ghi trước khi cập nhật
      { returnDocument: 'after' }
    )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

// Nhiệm vụ của function này là lấy ra danh sách list board theo phân trang hoặc theo trường title trong ô search
const getBoards = async (userId, page, itemsPerPage, queryFilter) => {
  try {
    const queryConditions = [
      // Điều kiện 01: Board chưa bị xóa
      { _destroy: false },
      // Điều kiện 02: cái thằng userId đang thực hiện request này nó phải
      //  thuộc vào một trong 2 cái mảng ownerIds hoặc memberIds,
      //  sử dụng toán tử $all của mongodb
      { $or: [
        // Tìm kiếm xem userId có nằm trong mảng ownerIds hay memberIds không
        { ownerIds: { $all: [new ObjectId(userId)] } },
        { memberIds: { $all: [new ObjectId(userId)] } }
      ] }
    ]

    // Xử lý query filter cho từng trường hợp search board, vd: search theo title
    if (queryFilter) {
      // console.log(queryFilter) // -> { title: 'Board 01' }
      // console.log(Object.keys(queryFilter)) // -> { title }

      Object.keys(queryFilter).forEach(key => {
        // queryFilters[key] ví dụ queryFilters[title] nếu phía FE đẩy lên q[title]

        // Có phân biệt chữ hoa chữ thường
        // queryConditions.push({ [key]: { $regex: queryFilter[key] } })
        // queryConditions.push({ [key]: { $regex: queryFilter[key] } }) // push 1 object có key là key của queryFilter, value là giá trị của key đó

        // Không phân biệt chữ hoa chữ thường
        queryConditions.push({ [key]: { $regex: new RegExp(queryFilter[key], 'i') } })
      })
    }
    // console.log('queryConditions: ', queryConditions)

    const query = await GET_DB().collection(BOARD_COLLECTION_NAME).aggregate(
      [
        { $match: { $and: queryConditions } },
        // sort title của board theo A-Z (mặc định sẽ bị chữ B hoa đứng trước chữ a thường
        //  (theo chuẩn bảng mã ASCII))
        { $sort: { title: 1 } },
        // $facet để xử lý nhiều luồng trong một query
        { $facet: {
          // Luồng 01: Query Boards
          'queryBoards': [
            { $skip: pagingSkipValue(page, itemsPerPage) }, //Bỏ qua số lượng bản ghi của những page trước đó
            { $limit: itemsPerPage } // Giới hạn tối đa số lượng bản ghi trả về trên một page
          ],

          // Luồng 02: Query đếm tổng tất cả số lượng bản ghi boards trong DB
          //  và trả về vào biến: countedAllBoards
          'queryTotalBoards': [{ $count: 'countedAllBoards' }]
        } }
      ],
      // Khai báo thêm thuộc tính collation locale 'en' để fix vụ chữ B hoa và a thường ở trên
      // https://www.mongodb.com/docs/v6.0/reference/collation/#std-label-collation-document-fields
      { collation: { locale: 'en' } }
    ).toArray()
    // console.log('query: ', query)

    const res = query[0]
    // console.log('res.queryTotalBoards[0]: ', res.queryTotalBoards[0])
    return {
      boards: res.queryBoards || [],
      totalBoards: res.queryTotalBoards[0]?.countedAllBoards || 0
    }

  } catch (error) {
    throw new Error(error)
  }
}

const pushMemberIds = async (boardId, userId) => {
  try {

    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(boardId) },
      { $push: { memberIds: new ObjectId(userId) } },
      // returnDocument nhận giá trị: 'after': trả về bản ghi sau khi cập nhật,
      // 'before': bản ghi trước khi cập nhật
      { returnDocument: 'after' }
    )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

export const boardModel = {
  BOARD_COLLECTION_NAME,
  BOARD_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  getDetails,
  pushColumnOrderIds,
  pullColumnOrderIds,
  update,
  getBoards,
  pushMemberIds
}
