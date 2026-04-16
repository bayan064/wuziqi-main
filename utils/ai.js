// utils/ai.js
// 智能 AI：先求自胜，再做必防，最后通过一层前瞻规划进攻

const BOARD_SIZE = 15;
const AI_PLAYER = 2;
const HUMAN_PLAYER = 1;

/**
 * 电脑的回合落子算法
 * @param {Array} board 当前 15x15 棋盘
 * @returns {{row: Number, col: Number} | null} 落子坐标
 */
const getAIMove = (board) => {
  const candidates = getCandidateMoves(board);
  if (candidates.length === 0) return null;

  // 第一步：有直接赢棋点就立即结束比赛
  const aiWinningMoves = findWinningMoves(board, AI_PLAYER, candidates);
  if (aiWinningMoves.length > 0) {
    return chooseBestByLocalScore(board, aiWinningMoves);
  }

  // 第二步：有玩家直接赢棋点就优先堵住
  const humanWinningMoves = findWinningMoves(board, HUMAN_PLAYER, candidates);
  if (humanWinningMoves.length > 0) {
    return chooseBestByLocalScore(board, humanWinningMoves);
  }

  // 第三步：基础评分 + 一层前瞻（避免送对手必胜手）
  const quickRanked = candidates
    .map((move) => ({ move, score: getQuickScore(board, move) }))
    .sort((a, b) => b.score - a.score);

  // 只对前若干候选做深一点的评估，兼顾速度与质量
  const topCandidates = quickRanked.slice(0, 18);
  let best = topCandidates[0];

  for (let i = 0; i < topCandidates.length; i++) {
    const move = topCandidates[i].move;
    const deepScore = getLookaheadScore(board, move);
    if (deepScore > best.score) {
      best = { move, score: deepScore };
    }
  }

  return best.move;
};

function getLookaheadScore(board, move) {
  const simulated = cloneBoard(board);
  simulated[move.row][move.col] = AI_PLAYER;

  // 理论兜底：若该点已成五连，直接拉满
  if (isWinningMove(simulated, move.row, move.col, AI_PLAYER)) {
    return 1e9;
  }

  const oppCandidates = getCandidateMoves(simulated);
  const oppWinningMoves = findWinningMoves(simulated, HUMAN_PLAYER, oppCandidates);
  const aiNextWinningMoves = findWinningMoves(simulated, AI_PLAYER, oppCandidates);

  let score = getQuickScore(board, move);

  // 下完后若给了对手直接赢点，强烈惩罚
  if (oppWinningMoves.length > 0) {
    score -= 250000 + oppWinningMoves.length * 12000;
  }

  // 若形成下回合多杀点，强烈加分
  if (aiNextWinningMoves.length > 0) {
    score += 120000 + aiNextWinningMoves.length * 10000;
  }

  return score;
}

function getQuickScore(board, move) {
  const { row, col } = move;
  let score = 0;

  // 进攻权重略高于防守，避免只会堵不会赢
  score += evaluatePosition(board, row, col, AI_PLAYER) * 1.25;
  score += evaluatePosition(board, row, col, HUMAN_PLAYER) * 1.05;

  // 中心偏好
  const center = 7;
  const distanceToCenter = Math.abs(row - center) + Math.abs(col - center);
  score += (28 - distanceToCenter) * 0.45;

  // 邻近已有棋子更优，避免落到无关远点
  score += getNeighborhoodBonus(board, row, col);

  return score;
}

function getNeighborhoodBonus(board, row, col) {
  let bonus = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(nr, nc)) continue;
      if (board[nr][nc] === AI_PLAYER) bonus += 18;
      else if (board[nr][nc] === HUMAN_PLAYER) bonus += 12;
    }
  }
  return bonus;
}

function chooseBestByLocalScore(board, moves) {
  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (let i = 0; i < moves.length; i++) {
    const score = getQuickScore(board, moves[i]);
    if (score > bestScore) {
      bestScore = score;
      bestMove = moves[i];
    }
  }
  return bestMove;
}

function findWinningMoves(board, player, moves) {
  const result = [];
  for (let i = 0; i < moves.length; i++) {
    const { row, col } = moves[i];
    const simulated = cloneBoard(board);
    simulated[row][col] = player;
    if (isWinningMove(simulated, row, col, player)) {
      result.push({ row, col });
    }
  }
  return result;
}

function getCandidateMoves(board) {
  const occupied = getOccupiedCount(board);
  if (occupied === 0) return [{ row: 7, col: 7 }];

  const result = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) continue;
      if (hasNearbyStone(board, r, c, 2)) {
        result.push({ row: r, col: c });
      }
    }
  }

  // 极端情况下兜底
  if (result.length === 0) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 0) result.push({ row: r, col: c });
      }
    }
  }
  return result;
}

function getOccupiedCount(board) {
  let count = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) count++;
    }
  }
  return count;
}

function hasNearbyStone(board, row, col, radius) {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(nr, nc)) continue;
      if (board[nr][nc] !== 0) return true;
    }
  }
  return false;
}

function isWinningMove(board, row, col, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (let i = 0; i < directions.length; i++) {
    const [dx, dy] = directions[i];
    let count = 1;

    for (let step = 1; step <= 4; step++) {
      const nr = row + dx * step;
      const nc = col + dy * step;
      if (!inBounds(nr, nc) || board[nr][nc] !== player) break;
      count++;
    }

    for (let step = 1; step <= 4; step++) {
      const nr = row - dx * step;
      const nc = col - dy * step;
      if (!inBounds(nr, nc) || board[nr][nc] !== player) break;
      count++;
    }

    if (count >= 5) return true;
  }

  return false;
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function cloneBoard(board) {
  return board.map((line) => line.slice());
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

  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (let i = 0; i < directions.length; i++) {
    const [dx, dy] = directions[i];
    totalScore += evaluateDirection(board, row, col, dx, dy, player);
  }

  return totalScore;
}

/**
 * 评估单个方向上的分数
 */
function evaluateDirection(board, row, col, dx, dy, player) {
  let count = 1;
  let openLeft = 0;
  let openRight = 0;

  for (let step = 1; step <= 5; step++) {
    const newRow = row + dx * step;
    const newCol = col + dy * step;
    if (!inBounds(newRow, newCol)) break;
    if (board[newRow][newCol] === player) {
      count++;
    } else if (board[newRow][newCol] === 0) {
      openRight++;
      break;
    } else {
      break;
    }
  }

  for (let step = 1; step <= 5; step++) {
    const newRow = row - dx * step;
    const newCol = col - dy * step;
    if (!inBounds(newRow, newCol)) break;
    if (board[newRow][newCol] === player) {
      count++;
    } else if (board[newRow][newCol] === 0) {
      openLeft++;
      break;
    } else {
      break;
    }
  }

  const totalOpen = openLeft + openRight;

  if (count >= 5) return 100000;
  if (count === 4) {
    if (totalOpen >= 2) return 50000;
    if (totalOpen >= 1) return 22000;
    return 1200;
  }
  if (count === 3) {
    if (totalOpen >= 2) return 7000;
    if (totalOpen >= 1) return 500;
  }
  if (count === 2) {
    if (totalOpen >= 2) return 700;
    if (totalOpen >= 1) return 45;
  }

  return 6;
}

module.exports = {
  getAIMove
};