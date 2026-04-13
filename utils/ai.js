// utils/ai.js
// 智能 AI：会堵玩家 + 自己进攻

/**
 * 电脑的回合落子算法
 * @param {Array} board 当前 15x15 棋盘
 * @returns {row: Number, col: Number} 落子坐标
 */
const getAIMove = (board) => {
  // 收集所有空位
  let emptySpots = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (board[r][c] === 0) {
        emptySpots.push({ row: r, col: c });
      }
    }
  }

  if (emptySpots.length === 0) return null;

  // 给每个空位打分
  let bestScore = -1;
  let bestMove = emptySpots[0];

  for (let spot of emptySpots) {
    let score = 0;
    
    // 进攻分：AI 自己（白棋=2）下在这里的分数
    score += evaluatePosition(board, spot.row, spot.col, 2) * 1.0;
    
    // 防守分：堵玩家（黑棋=1）下在这里的分数，防守权重更高
    score += evaluatePosition(board, spot.row, spot.col, 1) * 1.2;
    
    // 中心偏好：让 AI 更倾向于占中心
    const center = 7;
    const distanceToCenter = Math.abs(spot.row - center) + Math.abs(spot.col - center);
    score += (28 - distanceToCenter) * 0.5;
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = spot;
    }
  }

  return bestMove;
}

/**
 * 评估在某个位置下棋的分数
 * @param {Array} board 棋盘
 * @param {Number} row 行
 * @param {Number} col 列
 * @param {Number} player 玩家（1=黑棋玩家，2=白棋AI）
 * @returns {Number} 分数
 */
function evaluatePosition(board, row, col, player) {
  let totalScore = 0;
  
  // 四个方向：水平、垂直、主对角线、次对角线
  const directions = [
    [1, 0],   // 水平
    [0, 1],   // 垂直
    [1, 1],   // 主对角线
    [1, -1]   // 次对角线
  ];
  
  for (let [dx, dy] of directions) {
    totalScore += evaluateDirection(board, row, col, dx, dy, player);
  }
  
  return totalScore;
}

/**
 * 评估单个方向上的分数
 */
function evaluateDirection(board, row, col, dx, dy, player) {
  let count = 1;  // 当前棋子
  let openLeft = 0;
  let openRight = 0;
  
  // 正方向延伸
  for (let step = 1; step <= 5; step++) {
    const newRow = row + dx * step;
    const newCol = col + dy * step;
    if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15) break;
    if (board[newRow][newCol] === player) {
      count++;
    } else if (board[newRow][newCol] === 0) {
      openRight++;
      break;
    } else {
      break;
    }
  }
  
  // 负方向延伸
  for (let step = 1; step <= 5; step++) {
    const newRow = row - dx * step;
    const newCol = col - dy * step;
    if (newRow < 0 || newRow >= 15 || newCol < 0 || newCol >= 15) break;
    if (board[newRow][newCol] === player) {
      count++;
    } else if (board[newRow][newCol] === 0) {
      openLeft++;
      break;
    } else {
      break;
    }
  }
  
  // 根据连子数量返回分数
  const totalOpen = openLeft + openRight;
  
  if (count >= 5) return 100000;  // 直接获胜
  if (count === 4) {
    if (totalOpen >= 1) return 30000;  // 活四
    return 1000;  // 死四
  }
  if (count === 3) {
    if (totalOpen >= 2) return 5000;   // 活三
    if (totalOpen >= 1) return 200;    // 死三
  }
  if (count === 2) {
    if (totalOpen >= 2) return 400;    // 活二
    if (totalOpen >= 1) return 20;     // 死二
  }
  if (count === 1) return 5;
  
  return 0;
}

module.exports = {
  getAIMove
}