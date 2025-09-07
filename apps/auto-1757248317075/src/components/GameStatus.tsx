import React from 'react';
import { useGameStore } from '../gameStore';

export const GameStatus: React.FC = () => {
  const { 
    roomId, 
    players, 
    gameStarted, 
    winner, 
    startGame, 
    leaveRoom, 
    error 
  } = useGameStore();

  const playersList = Object.values(players);
  const canStartGame = playersList.length === 2 && !gameStarted;

  const getWinnerMessage = () => {
    if (winner === 'draw') return '무승부입니다!';
    if (winner === 'black') {
      const blackPlayer = playersList.find(p => p.stone === 'black');
      return `흑돌 승리! ${blackPlayer?.name || '흑돌'}이 이겼습니다!`;
    }
    if (winner === 'white') {
      const whitePlayer = playersList.find(p => p.stone === 'white');
      return `백돌 승리! ${whitePlayer?.name || '백돌'}이 이겼습니다!`;
    }
    return '';
  };

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f8f9fa', 
      borderRadius: '8px', 
      margin: '10px 0' 
    }}>
      {roomId && (
        <div style={{ marginBottom: '15px' }}>
          <h3>방 정보</h3>
          <p><strong>방 ID:</strong> {roomId}</p>
          <p><strong>참가자:</strong> {playersList.length}/2</p>
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <h4>플레이어 목록</h4>
        {playersList.length === 0 ? (
          <p>참가자가 없습니다.</p>
        ) : (
          <div>
            {playersList.map(player => (
              <div 
                key={player.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '5px',
                  padding: '5px',
                  backgroundColor: 'white',
                  borderRadius: '4px'
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: player.stone === 'black' ? '#000' : '#fff',
                    border: player.stone === 'white' ? '2px solid #999' : 'none',
                    marginRight: '10px'
                  }}
                />
                <span style={{ fontWeight: 'bold' }}>
                  {player.name} ({player.stone === 'black' ? '흑돌' : '백돌'})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px',
          color: '#c00'
        }}>
          {error}
        </div>
      )}

      {winner && (
        <div style={{
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          padding: '15px',
          borderRadius: '4px',
          marginBottom: '15px',
          color: '#155724',
          textAlign: 'center',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          {getWinnerMessage()}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {canStartGame && (
          <button
            onClick={startGame}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            게임 시작
          </button>
        )}

        {roomId && (
          <button
            onClick={leaveRoom}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            방 나가기
          </button>
        )}
      </div>

      {!gameStarted && playersList.length < 2 && (
        <p style={{ marginTop: '15px', color: '#666' }}>
          게임을 시작하려면 2명의 플레이어가 필요합니다.
        </p>
      )}
    </div>
  );
};