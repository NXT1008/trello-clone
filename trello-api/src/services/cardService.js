/**
 * Updated by Xuanthe's author on December 14 2024
 */

import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'

const createNew = async (reqBody) => {
  try {
    // Xử lý logic dữ liệu
    const newCard = {
      ...reqBody
    }
    const createdCard = await cardModel.createNew(newCard)
    const getNewCard = await cardModel.fineOneById(createdCard.insertedId)

    //...
    if (getNewCard) {
      // Đẩy gí trị card._id vào cuối mảng cardOrderIds trong collection Columns
      await columnModel.pushCardOrderIds(getNewCard)
    }

    return getNewCard
  } catch (error) { throw error }
}

const update = async (cardId, reqBody, cardCoverFile, userInfo) => {
  try {
    const updateData = {
      ...reqBody,
      updatedAt: Date.now()
    }

    let updatedCard = {}

    if (cardCoverFile) {
      const uploadResult = await CloudinaryProvider.streamUpload(cardCoverFile.buffer, 'card-covers')

      updatedCard = await cardModel.update(cardId, { cover: uploadResult.secure_url })
    } else if (updateData.commentToAdd) {
      // commentToAdd là key của FE gửi lên trong file ActiveCard.jsx ở hàm onAddCardComment

      // Tạo dữ liệu comment để lưu vào Database, cần bổ sung thêm những fields cần thiết
      // Do dữ liệu comments lưu trong Card Model cần 6 key, nhưng FE chỉ mới gửi 3 key đó là content, userAvatar, userDisplayName
      const commentData = {
        ...updateData.commentToAdd,
        userId: userInfo._id,
        userEmail: userInfo.email,
        commentedAt: Date.now()
      }
      updatedCard = await cardModel.unshiftNewComment(cardId, commentData)

    } else if (updateData.incomingMemberInfo) {
      // Trường hợp ADD thành viên vào Card hoặc REMOVE ra khỏi Card
      updatedCard = await cardModel.updateMembers(cardId, updateData.incomingMemberInfo)
    } else {
      // Các trường hợp update chung như title, description ...vv
      updatedCard = await cardModel.update(cardId, updateData)
    }


    return updatedCard
  } catch (error) { throw error }
}

export const cardService = {
  createNew,
  update
}
