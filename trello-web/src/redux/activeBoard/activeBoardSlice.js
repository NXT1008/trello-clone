import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import authorizedAxiosInstance from '~/utils/authorizeAxios'
import { API_ROOT } from '~/utils/constants'
import { mapOrder } from '~/utils/sorts'
import { isEmpty } from 'lodash'
import { generatePlaceholderCard } from '~/utils/formatters'

// Khởi tạo giá trị State của 1 cái Slice trong redux
const initialState = {
  currentActiveBoard: null
}

// Các hành động gọi api (bất đồng bộ) và cập nhật dữ liệu vào Redux,
//  dùng Middleware createAsyncThunk đi kèm với extraReducers
// https://redux-toolkit.js.org/api/createAsyncThunk
export const fetchBoardDetailsAPI = createAsyncThunk(
  'activeBoard/fetchBoardDetailsAPI',
  async (boardId) => {
    const response = await authorizedAxiosInstance.get(`${API_ROOT}/v1/boards/${boardId}`)
    // Axios sẽ trả kết quả về thông qua property của nó là data
    return response.data
  }
)

// Khởi tạo một cái Slice trong kho lưu trữ - Redux Store
export const activeBoardSlice = createSlice({
  name: 'activeBoard',
  initialState,
  // Reducers: Nơi xử lý dữ liệu đồng bộ
  reducers: {
    // Lưu ý luôn là ở đây luôn luôn cần cặp ngoặc nhọn cho function trong reducer
    // cho dù code bên trong chỉ có 1 dòng, đây là rule của Redux
    // https://redux-toolkit.js.org/usage/immer-reducers#mutating-and-returning-state
    updateCurrentActiveBoard: (state, action) => {
      // action.payload là chuẩn đặt tên nhận dữ liệu vào reducer
      // ở đây chúng ta gán nó ra một biến có nghĩa hơn
      let board = action.payload

      // Xử lý dữ liệu nếu cần thiết...
      // ...

      // Update lại dữ liệu của cái currentActiveBoard
      state.currentActiveBoard = board
    },
    updateCardInBoard: (state, action) => {
      // Update nested data
      // https://redux-toolkit.js.org/usage/immer-reducers#updating-nested-data
      const incomingCard = action.payload

      // Tìm dần từ board > column > card
      // Tìm ra column mà chứa card đang được update
      const column = state.currentActiveBoard.columns.find(i => i._id === incomingCard.columnId)
      if (column) {
        // Tìm card có id trùng với id của incomingCard
        const card = column.cards.find(i => i._id === incomingCard._id)
        if (card) {
          // Tiến hành update
          // card.title = incomingCard.title
          // card['title'] = incomingCard['title']

          /**
           * Dùng Object.keys để lấy toàn bộ các properties (keys) của incomingCard
           *  về một Array rồi forEach nó ra.
           * Sau đó tùy vào trường hợp cần thì kiểm tra thêm còn không thì cập nhật
           *  ngược lại giá trị vào card luôn như bên dưới.
          */
          Object.keys(incomingCard).forEach(key => {
            card[key] = incomingCard[key]
          })
        }
      }
    }
  },
  // extraReducers: Nơi xử lý dữ liệu bất đồng bộ
  extraReducers: (builder) => {
    builder.addCase(fetchBoardDetailsAPI.fulfilled, (state, action) => {
      // Action.payload ở đây chính là cái response.data trả về ở hàm gọi API
      const board = action.payload

      // Thành viên trong Board sẽ là gộp lại của 2 mảng members và owners
      board.FE_allUsers = board.owners.concat(board.members)

      // Xử lý dữ liệu nếu cần thiết...
      // Sắp xếp thứ tự các Column luôn ở đây trước khi đưa dữ liệu xuống bên dưới
      // các Component con
      board.columns = mapOrder(board.columns, board.columnOrderIds, '_id')

      board.columns.forEach(column => {
        // Khi F5 trang Web thì column rỗng nó sẽ chưa có card
        // Cần xử lý vấn đề kéo thả vào một column rỗng (commit 22)
        if (isEmpty(column.cards)) {
          column.cards = [generatePlaceholderCard(column)]
          column.cardOrderIds = [generatePlaceholderCard(column)._id]
        } else {
          // Sắp xếp thứ tự các Card luôn ở đây trước khi đưa dữ liệu xuống bên dưới
          // các Component con
          column.cards = mapOrder(column.cards, column.cardOrderIds, '_id')
        }
      })

      // Update lại dữ liệu của cái currentActiveBoard
      state.currentActiveBoard = board
    })
  }
})

// Action creators are generated for each case reducer function
// Actions: Là nơi dành cho các components bên dưới gọi bằng dispatch() tới nó
//  để cập nhật lại dữ liệu thông qua reducer (chạy đồng bộ)
// Để ý ở trên thì không thấy properties actions đâu cả, bởi vì những cái actions
//  này đơn giản là được thằng redux tạo tự động theo tên của reducer nhé.
// Mỗi reducer là một action nên có bao nhiêu thì phải khai báo bấy nhiêu.
export const { updateCurrentActiveBoard, updateCardInBoard } = activeBoardSlice.actions

// Selectors: Là nơi dành cho các components bên dưới gọi bằng hook useSelector()
//  để lấy dữ liệu từ trong kho redux store ra sử dụng
export const selectCurrentActiveBoard = (state) => {
  return state.activeBoard.currentActiveBoard
}

// Cái file này tên là activeBoardSlice NHƯNG chúng ta sẽ export một thứ tên là Reducer
// export default activeBoardSlice.reducer
export const activeBoardReducer = activeBoardSlice.reducer