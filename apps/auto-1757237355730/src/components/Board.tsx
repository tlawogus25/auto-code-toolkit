import React from 'react'
import { BOARD_SIZE, Position } from '../types/game'
import { useGameStore } from '../store/gameStore'
import { websocketService } from '../services/websocketService'

const Board: React.FC = () => {
  const { gameState, currentRoom, playerColor } = useGameStore()

  const handleCellClick = (row: number, col: number) => {
    if (!currentRoom || !playerColor) {
      return
    }

    if (gameState.isGameOver) {
      return
    }

    if (gameState.currentPlayer !== playerColor) {
      return
    }

    if (gameState.board[row][col] !== null) {
      return
    }

    const position: Position = { row, col }
    websocketService.makeMove(currentRoom.id, position)
  }

  const getCellContent = (row: number, col: number) => {
    const cellState = gameState.board[row][col]
    if (cellState === 'black') {
      return '●'
    } else if (cellState === 'white') {
      return '○'
    }
    return ''
  }

  const isCellClickable = (row: number, col: number) => {
    return (
      currentRoom &&
      playerColor &&
      !gameState.isGameOver &&
      gameState.currentPlayer === playerColor &&
      gameState.board[row][col] === null
    )
  }

  return (
    <div className="board-container">
      <div className="board">
        {Array.from({ length: BOARD_SIZE }, (_, row) =>
          Array.from({ length: BOARD_SIZE }, (_, col) => (
            <div
              key={`${row}-${col}`}
              className={`cell ${isCellClickable(row, col) ? 'clickable' : ''}`}
              onClick={() => handleCellClick(row, col)}
              style={{
                gridRow: row + 1,
                gridColumn: col + 1
              }}
            >
              {getCellContent(row, col)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Board