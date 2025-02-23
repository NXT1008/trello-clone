/**
 * Updated by Xuanthe's author on December 14 2024
 */
import { env } from '~/config/environment'

// Những Domain được phép truy cập tới tài nguyên của Server
export const WHITELIST_DOMAINS = [
  // Không cần Local Host nữa vì ở file config/cor đã luôn luôn cho phép môi trường dev
  // env.BUILD_MODE === 'dev'
  // 'http://localhost:5173'
  'https://vite-trello-web.vercel.app'
]

export const BOARD_TYPES = {
  PUBLIC: 'public',
  PRIVATE: 'private'
}

export const WEBSITE_DOMAIN =
  env.BUILD_MODE === 'production'
    ? env.WEBSITE_DOMAIN_PRODUCTION
    : env.WEBSITE_DOMAIN_DEVELOPMENT

export const DEFAULT_PAGE = 1
export const DEFAULT_ITEMS_PER_PAGE = 12

export const INVITATION_TYPES = {
  BOARD_INVITATION: 'BOARD_INVITATION'
}
export const BOARD_INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED'
}

export const CARD_MEMBER_ACTIONS = {
  ADD: 'ADD',
  REMOVE: 'REMOVE'
}
