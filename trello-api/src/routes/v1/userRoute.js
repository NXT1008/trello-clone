/**
* "A bit of fragrance clings to the hand that gives flowers!"
*/
import express from 'express'
import { userValidation } from '~/validations/userValidation'
import { userController } from '~/controllers/userController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { multerUploadMiddleware } from '~/middlewares/multerUploadMiddleware'

const Router = express.Router()

Router.route('/register')
  .post(userValidation.createNew, userController.createNew)

Router.route('/verify')
  .put(userValidation.verifyAccount, userController.verifyAccount)

Router.route('/login')
  .post(userValidation.login, userController.login)

Router.route('/logout')
  .delete(userController.logout)

Router.route('/refresh_token')
  .get(userController.refreshToken)

// Người dùng đã đăng nhập rồi mới được phép cập nhật thôn tin nên cần đi qua tầng middleware
Router.route('/update')
  .put(
    authMiddleware.isAuthorized,
    // avatar là tên của biến ở trong FormData mà FE đã gửi lên
    multerUploadMiddleware.upload.single('avatar'),
    userValidation.update,
    userController.update
  )

export const userRoute = Router
