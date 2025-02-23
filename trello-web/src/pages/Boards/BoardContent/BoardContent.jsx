import Box from '@mui/material/Box'
import ListColumns from './ListColumns/ListColumns'

import {
  DndContext,
  // MouseSensor,
  // TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  closestCorners,
  // closestCenter,
  pointerWithin,
  // rectIntersection,
  getFirstCollision
} from '@dnd-kit/core'
import { MouseSensor, TouchSensor } from '~/customLibraries/DndKitSensors'
import { arrayMove } from '@dnd-kit/sortable'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cloneDeep, isEmpty } from 'lodash'
import { generatePlaceholderCard } from '~/utils/formatters'

import Column from './ListColumns/Column/Column'
import Card from './ListColumns/Column/ListCards/Card/Card'

// Biến để kiểm tra item đang kéo thả có kiểu là column hay card?
const ACTIVE_DRAG_ITEM_TYPE = {
  COLUMN: 'ACTIVE_DRAG_ITEM_TYPE_COLUMN',
  CARD: 'ACTIVE_DRAG_ITEM_TYPE_CARD'
}

function BoardContent({
  board,
  moveColumns,
  moveCardInTheSameColumn,
  moveCardToDifferentColumn
}) {
  // https://docs.dndkit.com/api-documentation/sensors
  // https://github.com/clauderic/dnd-kit/blob/master/stories/2%20-%20Presets/Sortable/MultipleContainers.tsx
  // const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 10 } })

  // Yêu cầu con trỏ chuột di chuyển 10px thì mới kích hoạt event kéo thả
  // Fix trường hợp click thì bị gọi event
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 10 }
  })
  // Nhấn giữ 250ms và dung sai của cảm ứng thì mới kích hoạt event
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 500 }
  })
  // Ưu tiên sử dụng kết hợp cả 2 loại sensors là mouse và touch để có trải nghiệm mobile tốt nhất
  const sensors = useSensors(mouseSensor, touchSensor)

  // state chứa dữ liệu của board
  const [orderedColumns, setOrderedColumns] = useState([])

  // Cùng một thời điểm chỉ có một phần tử đang được kéo thả (Card hoặc Column)
  const [activeDragItemId, setActiveDragItemId] = useState(null)
  const [activeDragItemType, setActiveDragItemType] = useState(null)
  const [activeDragItemData, setActiveDragItemData] = useState(null)
  const [oldColumnWhenDraggingCard, setOldColumnWhenDraggingCard] = useState(null)

  // Điểm va chạm cuối cùng trước đó (xử lý thuật toán phát hiện va chạm)
  const lastOverId = useRef(null)

  // useEffect sắp xếp dữ liệu theo columnOrderIds
  useEffect(() => {
    // Columns đã được sắp xếp ở Component cha cao nhất boards/_id.jsx
    setOrderedColumns(board.columns)
  }, [board])

  // Tìm một Column theo CardId
  const findColumnByCardId = (cardId) => {
    // Đoạn này lưu ý, nên dùng c.cards thay vì c.cardOrderIds bởi vì ở bước handDragOver ta sẽ làm
    // dữ liệu cho cards hoàn chỉnh trước rồi mới tạo ra cardOrderIds mới
    return orderedColumns.find(column =>
      column?.cards?.map(card => card._id)?.includes(cardId))
  }

  // Khởi tạo Function chung xử lý việc cập nhật lại state
  // trong trường hợp di chuyển giữa các column khác nhau
  const moveCardBetweenDifferentColumns = (
    overColumn,
    overCardId,
    active,
    over,
    activeColumn,
    activeDraggingCardId,
    activeDraggingCardData,
    triggerFrom
  ) => {
    setOrderedColumns((prevColumns) => {
      // Tìm vị trí (index) của cái overCard trong column đích (nơi mà active card sắp được thả)
      const overCardIndex = overColumn?.cards?.findIndex(
        (card) => card._id === overCardId
      )

      /* Logic tính toán "newCardIndex" mới (trên hoặc dưới của overCard)
       * Tham khảo chuẩn từ thư viện dnd-kit
       */
      let newCardIndex
      const isBelowOverItem =
        active.rect.current.translated &&
        active.rect.current.translated.top > over.rect.top + over.rect.height
      const modifier = isBelowOverItem ? 1 : 0
      newCardIndex =
        overCardIndex >= 0
          ? overCardIndex + modifier
          : overColumn?.cards?.length + 1

      // Clone mảng OrderedColumnsState cũ ra một cái mới để xử lý data rồi return
      // và cập nhật lại OrderedColumnsState mới
      const nextColumns = cloneDeep(prevColumns)
      const nextActiveColumn = nextColumns.find(
        (column) => column._id === activeColumn._id
      )
      const nextOverColumn = nextColumns.find(
        (column) => column._id === overColumn._id
      )

      // nextActiveColumn: Column Cũ
      if (nextActiveColumn) {
        // Xóa Card ở Column Active (cũng có thể hiểu là Column cũ, cái lúc mà kéo Card ra khỏi nó
        // để sang Column khác)
        // Lấy lại toàn bộ Card không phải là Card đang Active
        nextActiveColumn.cards = nextActiveColumn.cards.filter(
          (card) => card._id !== activeDraggingCardId
        )

        // Thêm PlaceholderCard nếu Column rỗng
        if (isEmpty(nextActiveColumn.cards)) {
          nextActiveColumn.cards = [generatePlaceholderCard(nextActiveColumn)]
        }

        // Cập nhật lại mảng CardOrderIds cho chuẩn dữ liệu
        nextActiveColumn.cardOrderIds = nextActiveColumn.cards.map(
          (card) => card._id
        )
      }

      // nextOverColumn: Column mới
      if (nextOverColumn) {
        // Kiểm tra xem card đang kéo nó có tồn tại ở overColumn chưa, nếu có thì cần xóa nó trước
        nextOverColumn.cards = nextOverColumn.cards.filter(
          (card) => card._id !== activeDraggingCardId
        )

        // Phải cập nhật lại chuẩn dữ liệu columnId trong card
        // sau khi kéo card giữa 2 column khác nhau
        const rebuilt_activeDraggingCardData = {
          ...activeDraggingCardData,
          columnId: nextOverColumn._id
        }

        // Tiếp theo, thêm cái card đang kéo vào overColumn theo vị trí index mới
        nextOverColumn.cards = nextOverColumn.cards.toSpliced(
          newCardIndex,
          0,
          rebuilt_activeDraggingCardData
        )

        // Xóa placeHolderCard nếu nó đang tồn tại
        nextOverColumn.cards = nextOverColumn.cards.filter(
          (card) => !card.FE_PlaceholderCard
        )

        // Cập nhật lại mảng CardOrderIds cho chuẩn dữ liệu
        nextOverColumn.cardOrderIds = nextOverColumn.cards.map(
          (card) => card._id
        )
      }

      // Nếu Function được gọi từ handleDragEnd nghĩa là đã kéo thả xong
      // lúc này mới xử lý gọi API 1 lần ở đây
      if (triggerFrom === 'handleDragEnd') {
        /**
         * Gọi lên props function moveCardToDifferentColumn
         *  nằm ở component cha cao nhất (boards/_id.jsx)
         * Phải dùng tới activeDragItemData.columnId hoặc tốt nhất là
         *  oldColumnWhenDraggingCard._id (set vào state từ bước handleDragStart)
         *  chứ không phải activeData trong scope handleDragEnd này
         *  vì sau khi đi qua onDragOver và tới đây là state của card đã bị cập nhật một lần rồi.
         */
        moveCardToDifferentColumn(
          activeDraggingCardId, // Id card đang kéo
          oldColumnWhenDraggingCard._id, // Id column cũ
          nextOverColumn._id, // Id column mới
          nextColumns // Mảng card của column mới đã được sắp xếp sau khi kéo
        )
      }

      return nextColumns
    })
  }

  // Trigger khi bắt đầu kéo một phần tử
  const handleDragStart = (event) => {
    setActiveDragItemId(event?.active?.id) // Id phần tử đang kéo
    // Nếu phần tử đang kéo có chứa trường dữ liệu columnId => Đó là card
    setActiveDragItemType(
      event?.active?.data?.current?.columnId
        ? ACTIVE_DRAG_ITEM_TYPE.CARD
        : ACTIVE_DRAG_ITEM_TYPE.COLUMN
    )
    setActiveDragItemData(event?.active?.data?.current)

    // Nếu kéo card thì mới thực hiện hành động set giá trị OldColumn
    if (event?.active?.data?.current?.columnId) {
      setOldColumnWhenDraggingCard(findColumnByCardId(event?.active?.id))
    }
  }

  // Trigger trong quá trình kéo (drag) một phần tử
  const handleDragOver = (event) => {
    // Không làm gì thêm nếu đang kéo Column
    if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN) return

    // Nếu kéo Card thì xử lý thêm có thể kéo Card qua lại giữa các Columns
    const { active, over } = event

    // Cần đảm bảo nếu không tồn tại active hoặc over (khi kéo ra khỏi phạm vi Container)
    // thì không làm gì (tránh crash trang web)
    if (!active || !over) return

    // activeDraggingCard: là card đang được kéo
    const {
      id: activeDraggingCardId,
      data: { current: activeDraggingCardData }
    } = active
    // overCard: là cái card đang tương tác trên hoặc dưới so với cái card được kéo ở trên
    const { id: overCardId } = over

    // Tìm 2 cái columns theo cardId
    const activeColumn = findColumnByCardId(activeDraggingCardId)
    const overColumn = findColumnByCardId(overCardId)

    // Nếu không tồn tại 1 trong 2 column thì không làm gì hết, tránh crash trang web
    if (!activeColumn || !overColumn) return

    /**
     * Xử lý logic ở đây chỉ khi kéo card qua 2 bên column khác nhau, còn nếu kéo card trong chính
     * column ban đầu của nó thì không làm gì
     * Vì ở đây đoạn xử lý lúc kéo (handleDragOver), còn lúc nó kéo xong xuôi thì nó là vấn đề khác
     * ở handleDragEnd
     */
    if (activeColumn._id !== overColumn._id) {
      moveCardBetweenDifferentColumns(
        overColumn,
        overCardId,
        active,
        over,
        activeColumn,
        activeDraggingCardId,
        activeDraggingCardData,
        'handleDragOver'
      )
    }
  }

  // Trigger khi kết thúc hành động kéo một phần tử => hành động thả
  const handleDragEnd = (event) => {
    // console.log('Handle drag end: ',event)
    // Active: vị trí ban đầu
    // Over: vị trí lúc sau
    const { active, over } = event

    // Cần đảm bảo nếu không tồn tại active hoặc over (khi kéo ra khỏi phạm vi Container)
    // thì không làm gì (tránh crash trang web)
    if (!active || !over) return

    // Xử lý kéo thả Card
    if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.CARD) {
      // activeDraggingCard: là card đang được kéo
      const {
        id: activeDraggingCardId,
        data: { current: activeDraggingCardData }
      } = active
      // overCard: là cái card đang tương tác trên hoặc dưới so với cái card được kéo ở trên
      const { id: overCardId } = over

      // Tìm 2 cái columns theo cardId
      const activeColumn = findColumnByCardId(activeDraggingCardId)
      const overColumn = findColumnByCardId(overCardId)

      // Nếu không tồn tại 1 trong 2 column thì không làm gì hết, tránh crash trang web
      if (!activeColumn || !overColumn) return

      // Hành động kéo thả card qua 2 column khác nhau
      // Phải dùng tới activeDraggingCardData.columnId hoặc oldColumnWhenDraggingCard._id
      // (set vào state từ bước handleDragStart) chứ không phải active Data trong scope handleDragEnd
      // vì sau khi đi qua handleDragOver tới đây thì state của Card đã bị cập nhật một lần rồi
      if (oldColumnWhenDraggingCard._id !== overColumn._id) {
        moveCardBetweenDifferentColumns(
          overColumn,
          overCardId,
          active,
          over,
          activeColumn,
          activeDraggingCardId,
          activeDraggingCardData,
          'handleDragEnd'
        )
      } else {
        // Hành động kéo thả card trong cùng một cái Column

        // Lấy vị trí cũ (từ thằng oldColumnWhenDraggingCard)
        const oldCardIndex = oldColumnWhenDraggingCard?.cards?.findIndex(c => c._id === activeDragItemId)
        // Lấy vị trí cũ (từ thằng over)
        const newCardIndex = overColumn?.cards?.findIndex(c => c._id === overCardId)

        // Dùng arrayMove vì kéo card trong 1 cái column thì tương tự với logic kéo column
        // trong một cái board content
        const dndOrderedCards = arrayMove(
          oldColumnWhenDraggingCard?.cards, oldCardIndex, newCardIndex)
        // Lấy ra mảng cardOrderIds
        const dndOrderedCardIds = dndOrderedCards.map(card => card._id)

        setOrderedColumns(prevColumns => {
          // Clone mảng OrderedColumnsState cũ ra một cái mới để xử lý data rồi return
          // và cập nhật lại OrderedColumnsState mới
          const nextColumns = cloneDeep(prevColumns)

          // Tìm tới cái column mà ta đang thả
          const targetColumn = nextColumns.find(column => column._id === overColumn._id)

          // Cập nhật lại 2 giá trị mới là Cards và cardOrderIds trong cái targetColumn
          targetColumn.cards = dndOrderedCards
          targetColumn.cardOrderIds = dndOrderedCardIds

          // trả về state mới (chuẩn vị trí)
          return nextColumns
        })

        /**Gọi lên props function moveCardInTheSameColumn
         * nằm ở component cha cao nhất (boards/_id.jsx)
         */
        moveCardInTheSameColumn(
          dndOrderedCards, dndOrderedCardIds, oldColumnWhenDraggingCard._id)
      }
    }

    // Xử lý kéo thả Column trong một Cái boardContent
    if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN) {
      if (active.id !== over.id) {
        // Nếu vị trí sau khi kéo thả khác với vị trí ban đầu
        // Lấy vị trí cũ (từ thằng active)
        const oldColumnIndex = orderedColumns.findIndex((c) => c._id === active.id)
        // Lấy vị trí cũ (từ thằng over)
        const newColumnIndex = orderedColumns.findIndex((c) => c._id === over.id)

        // dùng hàm arrayMove của thư viện dnd-kit để sắp xếp lại mảng Columns ban đầu
        // Mảng object Columns
        const dndOrderedColumns = arrayMove(orderedColumns, oldColumnIndex, newColumnIndex)
        // Mảng id của Columns
        // const dndOrderedColumnsIds = dndOrderedColumns.map((c) => c._id)

        // Cập nhật lại state columns ban đầu sau khi đã kéo thả
        // Vẫn gọi updateState ở đây để tránh delay hoặc flickering giao diện lúc kéo thả
        // cần phải chờ gọi API (small trick)
        setOrderedColumns(dndOrderedColumns)

        // Gọi API
        // Gọi lên props function moveColumns nằm ở component cha cao nhất (boards/_id.jsx)
        moveColumns(dndOrderedColumns)
      }
    }

    // Những dữ liệu sau khi kéo thả này phải đưa về giá trị null mặc định ban đầu
    setActiveDragItemId(null)
    setActiveDragItemType(null)
    setActiveDragItemData(null)
    setOldColumnWhenDraggingCard(null)
  }

  /**
   * Animation khi thả (Drop) phần tử
   */
  const customDropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.5' } }
    })
  }

  // ChÚng ta sẽ custom lại thuật toán phát hiện va chạm tối ưu cho việc kéo thả card giữa nhiều column
  // args = arguments: Các tham số, đối số (Fix bug)
  const collisionDetectionStrategy = useCallback((args) => {
    // Nếu là kéo thả column thì vẫn sử dụng thuật toán cũ closestCorners là chuẩn nhất
    // Do thứ tự chạy là onDragStart -> strategy -> onDragOver ...
    if (activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN) {
      return closestCorners({ ...args })
    }

    // Tìm các điểm va chạm, trả về một mảng các va chạm - intersections với con trỏ
    const pointerIntersections = pointerWithin(args)

    // Nếu pointerIntersections là mảng rỗng, return luôn không làm gì hết.
    // Fix triệt để cái bug flickering của thư viện Dnd-kit trong trường hợp sau:
    // Kéo một cái card có image cover lớn và kéo lên phía trên cùng ra khỏi khu vực kéo thả
    if (!pointerIntersections?.length) return

    // Thuật toán phát hiện va chạm sẽ trả về một mảng các va chạm ở đây
    // const intersections = !!pointerIntersections?.length
    //   ? pointerIntersections
    //   : rectIntersection(args)

    // Tìm overId đầu tiên cho mảng intersections ở trên
    let overId = getFirstCollision(pointerIntersections, 'id')

    if (overId) {
      // Fix flickering
      // Nếu cái over nó là column thì sẽ tìm tới cái cardId gần nhất bên trong khu vực
      // va chạm đó dựa vào thuật toán phát hiện va chạm closestCenter hoặc closestCorners đều được.
      // Tuy nhiên ở đây dùng closestCorners vì thấy mượt mà hơn.
      const intersectColumn = orderedColumns.find(column => column._id === overId)
      if (intersectColumn) {
        // console.log('overId before: ', overId)
        overId = closestCorners({
          ...args,
          droppableContainers: args.droppableContainers.filter(container => {
            return (
              container.id !== overId &&
              intersectColumn?.cardOrderIds?.includes(container.id)
            )
          })
        })[0]?.id
        // console.log('overId after: ', overId)
      }

      lastOverId.current = overId
      return [{ id: overId }]
    }

    // Nếu overId là null thì trả về mảng rỗng - tránh bug crash trang
    return lastOverId ? [{ id: lastOverId.current }] : []
  }, [activeDragItemType, orderedColumns])

  return (
    <DndContext
      // Cảm biến
      sensors={sensors}
      /**
       * Thuật toán phát hiện va chạm (nếu không có nó thì card với cover lớn sẽ không kéo qua column được
       * vì lúc này nó đang bị conflict giữa card và column).
       * Chúng ta sẽ dùng closetCornors thay vì closetCenters
       * https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms
       * Update nếu chỉ dùng closetCornors thì sẽ có bug flickering (Va chạm liên tục khi
       * kéo card nằm giữa 2 column) */
      // collisionDetection={closestCorners}

      // Tự custom nâng cao thuật toán phát hiện va chạm
      // Bug - https://github.com/clauderic/dnd-kit/issues/1213#issuecomment-1691708378
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Box
        sx={{
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? '#34495e' : '#1976d2',
          width: '100%',
          height: (theme) => theme.trello.boardContentHeight,
          p: '10px 0'
        }}
      >
        <ListColumns
          columns={orderedColumns}
        />
        {/* Overlay: Column giữ chỗ */}
        <DragOverlay dropAnimation={customDropAnimation}>
          {!activeDragItemType && null}
          {/* Nếu như có phần tử column đang được kéo thì có 1 column giữ chỗ */}
          {activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.COLUMN && (
            <Column column={activeDragItemData} />
          )}
          {activeDragItemType === ACTIVE_DRAG_ITEM_TYPE.CARD && (
            <Card card={activeDragItemData} />
          )}
        </DragOverlay>
      </Box>
    </DndContext>
  )
}

export default BoardContent
