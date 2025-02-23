import { useEffect } from 'react'
import Container from '@mui/material/Container'
import AppBar from '~/components/AppBar/AppBar'
import BoardBar from './BoardBar/BoardBar'
import BoardContent from './BoardContent/BoardContent'

// import { mockData } from '~/apis/mock-data'
import {
  updateBoardDetailsAPI,
  updateColumnDetailsAPI,
  moveCardToDifferentColumnAPI
} from '~/apis'
import { cloneDeep } from 'lodash'
import {
  fetchBoardDetailsAPI,
  updateCurrentActiveBoard,
  selectCurrentActiveBoard
} from '~/redux/activeBoard/activeBoardSlice'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import PageLoadingSpinner from '~/components/Loading/PageLoadingSpiner'
import ActiveCard from '~/components/Modal/ActiveCard/ActiveCard'

function Board() {

  const dispatch = useDispatch()
  // Không dùng State của COmponent nữa mà chuyển qua dùng state của Redux
  // const [board, setBoard] = useState(null)
  const board = useSelector(selectCurrentActiveBoard)

  // boardId là param đã định nghĩa trong Route Board ở App.jsx
  const { boardId } = useParams()

  useEffect(() => {
    // const boardId = '675d53390a7f578ff4e07c6c'
    // Call API
    dispatch(fetchBoardDetailsAPI(boardId))
  }, [dispatch, boardId])

  /**Func này có nhiệm vụ gọi API và xử lý kéo thả Column
   * Chỉ cần gọi API để cập nhật mảng cardOrderIds của Column chứa nó (Thay đổi vị trí trong mảng)
   */
  const moveColumns = (dndOrderedColumns) => {
    // Biến dndOrderedColumns: Giá trị của Component con (BoardContent) nhận được và gửi lên
    // component cha (_id.jsx)
    const dndOrderedColumnsIds = dndOrderedColumns.map((c) => c._id)

    // Cập nhật lại dữ liệu state board
    /**
    * Trường hợp dùng Spread Operator này thì lại không sao bởi vì ở đây chúng ta không dùng
    *   push như ở trên làm thay đổi trực tiếp kiểu mở rộng mảng, mà chỉ đang gán lại toàn bộ
    *   giá trị columns và columnOrderIds bằng 2 mảng mới. Tương tự như cách làm concat ở trường
    *   hợp createNewColumn thôi :))
    */
    const newBoard = { ...board }
    newBoard.columns = dndOrderedColumns
    newBoard.columnOrderIds = dndOrderedColumnsIds
    // setBoard(newBoard)
    dispatch(updateCurrentActiveBoard(newBoard))

    // Gọi API cập nhật board
    // Chỉ cần cập nhật lại mảng columnOrderIds, vì mảng columns dựa vào nó để sắp xếp
    // nên không cần cập nhật mảng columns (Sắp xếp ở BoardContent.jsx)
    // Không cần async/await (sử dụng khi có hứng kết quả và có làm gì sau đó tiếp theo)
    updateBoardDetailsAPI(newBoard._id, { columnOrderIds: newBoard.columnOrderIds })
  }

  /**Khi di chuyển card trong cùng Column
   * Chỉ cần gọi API để cập nhật mảng cardOrderIds của Column chứa nó (Thay đổi vị trí trong mảng)
   */
  const moveCardInTheSameColumn = (dndOrderedCards, dndOrderedCardIds, columnId) => {
    // Update cho chuẩn dữ liệu state board

    //Tương tự hàm createNewColumn nên chỗ này dùng CloneDeep
    // const newBoard = { ...board }
    const newBoard = cloneDeep(board)

    const columnToUpdate = newBoard.columns.find(column => column._id === columnId)
    if (columnToUpdate) {
      columnToUpdate.cards = dndOrderedCards
      columnToUpdate.cardOrderIds = dndOrderedCardIds
    }
    // setBoard(newBoard)
    dispatch(updateCurrentActiveBoard(newBoard))

    // Gọi API
    updateColumnDetailsAPI(columnId, { cardOrderIds: dndOrderedCardIds })
  }

  /**
   * Khi di chuyển card sang Column khác:
   * B1: Cập nhật mảng cardOrderIds của Column ban đầu chứa nó
   *  (Hiểu bản chất là xóa cái _id của Card ra khỏi mảng)
   * B2: Cập nhật mảng cardOrderIds của Column tiếp theo
   *  (Hiểu bản chất là thêm _id của Card vào mảng)
   * B3: Cập nhật lại trường columnId mới của cái Card đã kéo
   * => Làm một API support riêng.
   */
  const moveCardToDifferentColumn = (
    currentCardId,
    prevColumnId,
    nextColumnId,
    dndOrderedColumns
  ) => {

    // Cập nhật lại dữ liệu state board
    const dndOrderedColumnsIds = dndOrderedColumns.map(c => c._id)
    const newBoard = { ...board }
    newBoard.columns = dndOrderedColumns
    newBoard.columnOrderIds = dndOrderedColumnsIds
    // setBoard(newBoard)
    dispatch(updateCurrentActiveBoard(newBoard))

    // Gọi API xử lý phía BE
    let prevCardOrderIds = dndOrderedColumns.find(c => c._id === prevColumnId)?.cardOrderIds
    // Xử lý vấn đề khi kéo Card cuối cùng ra khỏi Column, Column rỗng sẽ có placeholder card
    // cần xóa nó đi trước khi gửi dữ liệu cho phía BE
    if (prevCardOrderIds[0].includes('placeholder-card')) prevCardOrderIds = []

    moveCardToDifferentColumnAPI({
      currentCardId,
      prevColumnId,
      // Tìm lại mảng cardOrderIds của column cũ
      prevCardOrderIds,
      nextColumnId,
      // Tìm lại mảng cardOrderIds của column mới
      nextCardOrderIds: dndOrderedColumns.find(c => c._id === nextColumnId)?.cardOrderIds
    })
  }

  if (!board) {
    return <PageLoadingSpinner caption={'Loading Board...'}/>
  }

  return (
    <Container disableGutters maxWidth={false} sx={{ height: '100vh' }}>
      {/* Modal Active Card, check đóng/mở dựa theo cái State isShowModalActiveCard lưu trong Redux */}
      <ActiveCard />

      {/* Các thành phần còn lại của Board Details */}
      <AppBar />
      <BoardBar board={board} />
      <BoardContent
        board={board}

        // 3 cái trường hợp dưới đây thì giữ nguyên để code xử lý kéo thả ở phần BoardContent không bị
        //  quá dài mất kiểm soát khi đọc code, maintain...
        moveColumns={moveColumns}
        moveCardInTheSameColumn={moveCardInTheSameColumn}
        moveCardToDifferentColumn={moveCardToDifferentColumn}
      />
      {/* <BoardBar board={mockData?.board} />
      <BoardContent board={mockData?.board} /> */}
    </Container>
  )
}

export default Board
