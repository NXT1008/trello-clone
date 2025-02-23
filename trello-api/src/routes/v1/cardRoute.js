/**
 * Updated by Xuanthe's author on December 14 2024
 */

import express from 'express'
import { cardValidation } from '~/validations/cardValidation'
import { cardController } from '~/controllers/cardController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { multerUploadMiddleware } from '~/middlewares/multerUploadMiddleware'

const Router = express.Router()

Router.route('/')
  .post(authMiddleware.isAuthorized, cardValidation.createNew, cardController.createNew)

Router.route('/:id')
  .put(
    authMiddleware.isAuthorized,
    // cardCover là tên của biến ở trong FormData ActiveCard.jsx mà FE đã gửi lên
    multerUploadMiddleware.upload.single('cardCover'),
    cardValidation.update,
    cardController.update
  )


export const cardRoute = Router