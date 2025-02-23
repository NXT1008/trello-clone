/**
 * Updated by Xuanthe's author on December 14 2024
 */

import express from 'express'
import { StatusCodes } from 'http-status-codes'
import { boardRoute } from './boardRoute'
import { columnRoute } from './columnRoute'
import { cardRoute } from './cardRoute'
import { userRoute } from './userRoute'
import { invitationRoute } from './invitationRoute'

const Router = express.Router()

/** Check APIs v1/status */
Router.get('/status', (req, res) => {
  res.status(StatusCodes.OK).json({ message: 'APIs v1 are already to use.' })
})

/** Boards APIs */
Router.use('/boards', boardRoute)

/** Columns APIs */
Router.use('/columns', columnRoute)

/** Cards APIs */
Router.use('/cards', cardRoute)

/** Users APIs */
Router.use('/users', userRoute)

/** Invitations APIs */
Router.use('/invitations', invitationRoute)


export const APIs_V1 = Router
