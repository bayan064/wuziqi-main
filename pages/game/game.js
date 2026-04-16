// pages/game/game.js

import { drawBoard, getBoardPosition } from '../../utils/board.js';
const boardConfig = require('../../utils/board.js')//新增
const ruleConfig = require('../../utils/rule.js')
const skillConfig = require('../../utils/skill.js')
const aiConfig = require('../../utils/ai.js')

const BATTLE_RECORDS_KEY = 'battleRecords'

Page({
  data: {
    board: [],
    currentPlayer: 1,
    isGameOver: false,
    skills: [],
    canvasSize: 600,
    gameMode: 'ai',
    lastAIMove: null,
    lastBlackMove: null,
    lastWhiteMove: null,
    animatingMove: null ,
    // ✅ 新增：控制动画同步
    ready: false,
    gameMode: 'ai',  // 【新增】'ai' 或 'double'
    moveCount: 0,
    gameStartTime: 0,
    settlementVisible: false,
    settlementType: 'victory',
    settlementTitleEn: '',
    settlementTitleCn: '',
    settlementMessage: '',
    settlementThirdLabel: '',
    settlementThirdValue: '',
    settlementDurationText: '0秒',
    settlementRoundText: '0回合',
    aiSkillEnabled: true,
    showSkillHistoryPanel: false,
    skillHistory: []
  },

   onLoad(options) {
    console.log('=== onLoad 收到的参数 ===', options)
    const mode = options.mode || 'ai'
    this.setData({ gameMode: mode })
    console.log('=== 设置后的 gameMode ===', mode)
    this.initGame()
  },

  onReady() {
    this.initCanvas();
  },

  // === 游戏初始化 ===
  initGame() {
    // 初始化历史记录快照和被移除棋子记录，以及效果池
    this.boardHistory = [];
    this.removedPieces = [];
    this.playerEffects = {
      1: { silence: 0, protect: 0 },
      2: { silence: 0, protect: 0 }
    };
    this.aiCoachSkillUsage = {};
    this.aiCoachLastSkillId = null;
    this.aiCoachLastSkillRound = -99;
    this.playerSkillUseCount = 0;
    this.turnSkillUsed = false;

    // 1. 获取一个空的 15x15 棋盘 (调用外部模块)
    const newBoard = ruleConfig.resetGame ? ruleConfig.resetGame() : this._createEmptyBoard();
    
    const newSkills = skillConfig.getRandomSkills ? skillConfig.getRandomSkills(3) : [];

    const skillPages = [];
    for (let i = 0; i < newSkills.length; i += 3) {
      skillPages.push(newSkills.slice(i, i + 3));
    }

    // 黑白双方分别维护技能状态（冷却独立计算）
    this.playerSkillPages = {
      1: JSON.parse(JSON.stringify(skillPages)),
      2: JSON.parse(JSON.stringify(skillPages))
    };

    this.setData({
      board: newBoard,
      currentPlayer: 1,
      isGameOver: false,
      skills: newSkills,
      skillPages: this.playerSkillPages[1],
      lastAIMove: null,
      lastBlackMove: null,
      lastWhiteMove: null,
      animatingMove: null,
      pendingSkill: null,
      moveCount: 0,
      gameStartTime: Date.now(),
      settlementVisible: false,
      settlementRoundText: '0回合',
      showSkillHistoryPanel: false,
      skillHistory: []
    });

    if (this._ctx) {
      this.drawBoard();
    }
  },

  getSkillPagesByPlayer(player) {
    if (!this.playerSkillPages) return [];
    return this.playerSkillPages[player] || [];
  },

  syncCurrentPlayerSkillPages(player) {
    this.setData({ skillPages: this.getSkillPagesByPlayer(player) });
  },

  _createEmptyBoard() {
    let board = [];
    for (let r = 0; r < 15; r++) {
      board.push(new Array(15).fill(0));
    }
    return board;
  },

  // === Canvas 初始化（关键修改点）===
 initCanvas() {
  const query = wx.createSelectorQuery();
  query.select('#boardCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res[0]) return;

      const canvas = res[0].node;
      this._ctx = canvas.getContext('2d');

      const dpr = wx.getWindowInfo().pixelRatio;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      this._ctx.scale(dpr, dpr);

      this.setData({ canvasSize: res[0].width });

      // ❗先触发页面动画
      this.setData({ ready: true });

      // ✅ 等动画开始后再画canvas（关键）
      setTimeout(() => {
        this.drawBoard();
      }, 100);
    });
},

  drawBoard() {
    if (this._ctx) {
     drawBoard(
  this._ctx,
  this.data.board,
  this.data.canvasSize,
  this.data.lastAIMove,
  this.data.animatingMove
);
    }
  },

  // === 点击落子 ===
handleBoardClick(e) {
  console.log('=== 点击时 gameMode ===', this.data.gameMode, 'currentPlayer ===', this.data.currentPlayer)
  
  if (this.data.isGameOver) return;
  
  // 人机模式：只有黑棋（玩家）能下
  if (this.data.gameMode === 'ai' && this.data.currentPlayer !== 1) return;
  
  // 获取落子坐标
  const x = e.detail?.x ?? e.touches?.[0]?.x;
  const y = e.detail?.y ?? e.touches?.[0]?.y;
  
  if (x === undefined || y === undefined) {
    console.log('无法获取坐标')
    return
  }
  
  // 直接调用 boardConfig 的转换函数，传入原始坐标和 canvasSize
  let pos = boardConfig.getBoardPosition(x, y, this.data.canvasSize);
  
  if (pos.row !== -1 && pos.col !== -1) {
    this.processMove(pos.row, pos.col);
  }
  },

  // === 对战逻辑 ===
  processMove(row, col) {
    let board = this.data.board;

    // ----- [B同学技能拦截]：如果当前处于“选择棋子”的状态（比如飞沙走石） -----
    if (this.data.pendingSkill) {
      if (board[row][col] === 0) {
        wx.showToast({ title: '不能选空地，请点击对手棋子', icon: 'none' });
        return;
      }
      if (board[row][col] === this.data.currentPlayer) {
        wx.showToast({ title: '不能拿自己的棋子', icon: 'none' });
        return;
      }
      
      this.executeSkill(this.data.pendingSkill.index, this.data.pendingSkill.skill, { target: { row, col } });
      this.setData({ pendingSkill: null });
      return; 
    }
    // -------------------------------------------------------------

    // 判断该位置是否已有棋子
    if (board[row][col] !== 0) return;

    const player = this.data.currentPlayer;

    // 在任意玩家落子前记录快照（用于时光倒流）
    if (!this.boardHistory) this.boardHistory = [];
    this.boardHistory.push(JSON.parse(JSON.stringify(board)));

    board[row][col] = player;
    const nextMoveCount = this.data.moveCount + 1;
    this.setData({ moveCount: nextMoveCount });

    let nextHighlightMove = this.data.lastAIMove;
    let nextLastBlackMove = this.data.lastBlackMove;
    let nextLastWhiteMove = this.data.lastWhiteMove;

    if (player === 1) {
      nextLastBlackMove = { row, col };
    } else {
      nextLastWhiteMove = { row, col };
    }

    if (this.data.gameMode === 'ai' && player === 2) {
      nextHighlightMove = { row, col };
    }
    if (this.data.gameMode === 'double') {
      nextHighlightMove = player === 1 ? this.data.lastWhiteMove : this.data.lastBlackMove;
    }

    // ✅ AI 落子 → 启动动画
    if (player === 2) {
      this.setData({
        animatingMove: { row, col, progress: 0 },
        lastAIMove: nextHighlightMove,
        lastBlackMove: nextLastBlackMove,
        lastWhiteMove: nextLastWhiteMove
      });
      this.animatePiece(); // 启动动画
    } else {
      this.setData({
        board,
        lastAIMove: nextHighlightMove,
        lastBlackMove: nextLastBlackMove,
        lastWhiteMove: nextLastWhiteMove
      });
      this.drawBoard();
    }

    // ===== 胜负判断 =====
    if (ruleConfig.checkWin && ruleConfig.checkWin(board, row, col)) {
      this.handleWin(player);
      return;
    }

    this.updateSkillCooldowns(player);

    // 更新特效倒计时（减少自身身上挂着的所有buff/debuff的时间）
    if(this.playerEffects && this.playerEffects[player]) {
        for(let eff in this.playerEffects[player]) {
            if(this.playerEffects[player][eff] > 0) {
                this.playerEffects[player][eff]--;
            }
        }
    }

    // 切换玩家 (调用B同学的方法)
     // 切换玩家
  let nextPlayer = ruleConfig.switchPlayer ? ruleConfig.switchPlayer(this.data.currentPlayer) : (this.data.currentPlayer === 1 ? 2 : 1);
  this.setData({
    currentPlayer: nextPlayer,
    skillPages: this.getSkillPagesByPlayer(nextPlayer)
  });
  this.turnSkillUsed = false;

// 【修改】人机模式且轮到AI时，才调用AI落子
if (this.data.gameMode === 'ai' && nextPlayer === 2 && !this.data.isGameOver) {
   setTimeout(() => {
       this.processAITurn();
   }, 500);
}
// 双人模式：什么都不做，等另一个玩家点击
  },


  processAITurn() {
    if (this.data.isGameOver || this.data.gameMode !== 'ai' || this.data.currentPlayer !== 2) return;

    if (this.data.aiSkillEnabled) {
      const usedSkill = this.tryUseAISkill();
      if (usedSkill) {
        // 默认技能与落子二选一；时光倒流为例外，AI保留回合后要补一手落子
        if (!this.data.isGameOver && this.data.currentPlayer === 2) {
          setTimeout(() => {
            if (this.data.isGameOver || this.data.currentPlayer !== 2) return;
            if (aiConfig.getAIMove) {
              const aiMove = aiConfig.getAIMove(this.data.board);
              if (aiMove) {
                this.processMove(aiMove.row, aiMove.col);
              }
            }
          }, 420);
        }
        return;
      }
    }

    if (aiConfig.getAIMove) {
      let aiMove = aiConfig.getAIMove(this.data.board);
      if (aiMove) {
        this.processMove(aiMove.row, aiMove.col);
      }
    }
  },

  getFlattenSkillListByPlayer(player) {
    const skillPages = this.getSkillPagesByPlayer(player) || [];
    const result = [];
    let index = 0;

    for (let p = 0; p < skillPages.length; p++) {
      for (let s = 0; s < skillPages[p].length; s++) {
        result.push({ index, skill: skillPages[p][s] });
        index++;
      }
    }

    return result;
  },

  getPiecesByPlayer(player) {
    const pieces = [];
    const board = this.data.board;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (board[r][c] === player) {
          pieces.push({ row: r, col: c });
        }
      }
    }
    return pieces;
  },

  getPieceCountByPlayer(player) {
    return this.getPiecesByPlayer(player).length;
  },

  pickAIThrowTarget(opponentPieces) {
    if (!opponentPieces || opponentPieces.length === 0) return null;

    const lastBlackMove = this.data.lastBlackMove;
    if (lastBlackMove && this.data.board[lastBlackMove.row][lastBlackMove.col] === 1) {
      return { row: lastBlackMove.row, col: lastBlackMove.col };
    }

    const randomIndex = Math.floor(Math.random() * opponentPieces.length);
    return opponentPieces[randomIndex];
  },

  pickByWeight(candidates) {
    const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
      random -= candidates[i].weight;
      if (random <= 0) {
        return candidates[i];
      }
    }
    return candidates[candidates.length - 1];
  },

  tryUseAISkill() {
    if (this.turnSkillUsed) {
      return false;
    }

    if (this.playerEffects && this.playerEffects[2] && this.playerEffects[2].silence > 0) {
      return false;
    }

    const opponentPieces = this.getPiecesByPlayer(1);
    const opponentProtected = !!(this.playerEffects && this.playerEffects[1] && this.playerEffects[1].protect > 0);
    const aiPieceCount = this.getPieceCountByPlayer(2);
    const playerPieceCount = this.getPieceCountByPlayer(1);
    const mySkills = this.getFlattenSkillListByPlayer(2).filter((item) => item.skill.cooldown === 0 && !item.skill.usedUp);
    if (mySkills.length === 0) return false;

    const currentRound = Math.max(1, Math.ceil(this.data.moveCount / 2));
    const leadGap = aiPieceCount - playerPieceCount;

    const candidates = [];
    for (let i = 0; i < mySkills.length; i++) {
      const item = mySkills[i];
      const id = item.skill.id;

      if (id === 1) {
        if (opponentProtected) {
          continue;
        }
        const target = this.pickAIThrowTarget(opponentPieces);
        if (target) {
          candidates.push({
            ...item,
            weight: 4,
            extraTargetInfo: { target }
          });
        }
      } else if (id === 2) {
        const hasRemovedSelf = (this.removedPieces || []).some((piece) => piece.player === 2);
        if (hasRemovedSelf) {
          candidates.push({ ...item, weight: 3 });
        }
      } else if (id === 3) {
        if (opponentProtected) {
          continue;
        }
        if (opponentPieces.length > 0) {
          candidates.push({ ...item, weight: 3.5 });
        }
      } else if (id === 4) {
        candidates.push({ ...item, weight: 3.2 });
      } else if (id === 5) {
        candidates.push({ ...item, weight: 4 });
      } else if (id === 6) {
        if ((this.boardHistory || []).length > 0) {
          candidates.push({ ...item, weight: 2.2 });
        }
      } else if (id === 7) {
        candidates.push({ ...item, weight: 1.5 });
      } else if (id === 8) {
        if (this.data.moveCount >= 12) {
          candidates.push({ ...item, weight: 0.8 });
        }
      }
    }

    if (candidates.length === 0) return false;

    // 教练策略：优先展示没展示过的技能，避免连续复读同一个技能
    const enriched = candidates.map((item) => {
      const usage = this.aiCoachSkillUsage[item.skill.id] || 0;
      let weight = item.weight;

      if (usage === 0) weight += 2.5;
      else if (usage === 1) weight += 1.2;
      else weight += 0.3;

      if (this.aiCoachLastSkillId === item.skill.id) {
        weight *= 0.35;
      }

      // 电脑领先较多时，降低强压制技能频率，给玩家练习空间
      if (leadGap >= 3 && (item.skill.id === 1 || item.skill.id === 3 || item.skill.id === 8)) {
        weight *= 0.45;
      }

      // 力拔山兮仅在后期偶尔演示，避免频繁重置破坏体验
      if (item.skill.id === 8) {
        weight *= currentRound >= 10 ? 1 : 0.2;
      }

      return { ...item, weight: Math.max(0.1, weight) };
    });

    let useChance = 0.45;
    if (currentRound >= 4) useChance += 0.1;
    if (currentRound >= 8) useChance += 0.08;
    if (this.playerSkillUseCount <= 2) useChance += 0.12;
    if (leadGap >= 3) useChance -= 0.12;
    useChance = Math.max(0.3, Math.min(0.78, useChance));

    if (Math.random() > useChance) return false;

    const selected = this.pickByWeight(enriched);
    this.executeSkill(selected.index, selected.skill, selected.extraTargetInfo || null);

    return true;
  },

  // === 技能 ===
  handleSkillClick(e) {
    if (this.data.isGameOver) return;
    if (this.data.gameMode === 'ai' && this.data.currentPlayer !== 1) return;

    if (this.turnSkillUsed) {
      wx.showToast({ title: '本回合已使用技能', icon: 'none' });
      return;
    }
    
    // 如果已经处于选中技能状态，再次点击取消
    if (this.data.pendingSkill) {
        this.setData({ pendingSkill: null });
        wx.showToast({ title: '已取消技能目标选择', icon: 'none' });
        return;
    }

    let pObj = this.getSkillInfoFromEvent(e);
    if(!pObj) return;
    let { index, skill } = pObj;

    if (skill.usedUp) {
      wx.showToast({ title: '该技能本局已使用', icon: 'none' });
      return;
    }

    if(skill.cooldown > 0) {
        wx.showToast({ title: '技能冷却中', icon: 'none' });
        return;
    }

    // 【检查沉默状态】
    if (this.playerEffects && this.playerEffects[this.data.currentPlayer].silence > 0) {
        wx.showToast({ title: '受到静如止水效果，技能被封印！', icon: 'none' });
        return;
    }

    // 尝试执行（如果没有target看看是否要求target）
    this.executeSkill(index, skill, null);
  },

  getSkillInfoFromEvent(e) {
    let index = e.currentTarget.dataset.index;
    const currentSkillPages = this.getSkillPagesByPlayer(this.data.currentPlayer);
    // index是摊平后的index，在pages里找
    let globalIndex = 0;
    let targetSkill = null;
    for(let page of currentSkillPages) {
        for(let s of page) {
            if(globalIndex === index) { targetSkill = s; break; }
            globalIndex++;
        }
        if(targetSkill) break;
    }
    return targetSkill ? { index, skill: targetSkill } : null;
  },

  executeSkill(index, skill, extraTargetInfo) {
    if(!skillConfig.useSkill) return;

    if (skill.usedUp) {
      wx.showToast({ title: '该技能本局已使用', icon: 'none' });
      return;
    }

    let extraContext = { history: this.boardHistory, removedPieces: this.removedPieces, playerEffects: this.playerEffects };
    if (extraTargetInfo) { extraContext = Object.assign(extraContext, extraTargetInfo); }

    let result = skillConfig.useSkill(skill.id, this.data.board, this.data.currentPlayer, extraContext);
    
    if (result.requiresTarget) {
        wx.showToast({ title: '请在棋盘上点击目标棋子', icon: 'none' });
        this.setData({ pendingSkill: { index, skill } });
        return;
    }

    if(result.success) {
      const skillOwner = this.data.currentPlayer;
        this.turnSkillUsed = true;
        // 如果返回了清理后的历史记录（如时光倒流），则同步回去
        if (result.newHistory) {
            this.boardHistory = result.newHistory;
        }
        // 如果有移出的棋子
        if (result.removedPiece) {
            if(!this.removedPieces) this.removedPieces = [];
            this.removedPieces.push(result.removedPiece);
        }
        // 如果使用了复活（移出队列减少）
        if (result.newRemovedPieces) {
            this.removedPieces = result.newRemovedPieces;
        }
        // 如果附加了特效Buff/Debuff
        if (result.applyEffect) {
            let eff = result.applyEffect;
            this.playerEffects[eff.target][eff.effect] = eff.duration;
        }

        // 更新当前玩家自己的技能冷却
        let newSkillPages = JSON.parse(JSON.stringify(this.getSkillPagesByPlayer(this.data.currentPlayer)));
        let gIndex = 0;
        for(let p = 0; p < newSkillPages.length; p++) {
            for(let s = 0; s < newSkillPages[p].length; s++) {
                if (gIndex === index) {
              newSkillPages[p][s].cooldown = skill.maxCooldown;
              if (skill.id === 7 || skill.id === 8) {
                newSkillPages[p][s].usedUp = true;
              }
                }
                gIndex++;
            }
        }
        this.playerSkillPages[this.data.currentPlayer] = newSkillPages;

        if (skillOwner === 1) {
          this.playerSkillUseCount = (this.playerSkillUseCount || 0) + 1;
        }
        if (skillOwner === 2) {
          this.aiCoachSkillUsage[skill.id] = (this.aiCoachSkillUsage[skill.id] || 0) + 1;
          this.aiCoachLastSkillId = skill.id;
          this.aiCoachLastSkillRound = Math.max(1, Math.ceil(this.data.moveCount / 2));
        }

        this.pushSkillHistoryRecord(skillOwner, skill.name);
        
        this.setData({ 
            board: result.newBoard, // 技能改变了棋盘
          skillPages: this.getSkillPagesByPlayer(this.data.currentPlayer)
        });
        this.drawBoard();

        // 技能成功后默认结束回合；时光倒流为例外（保留回合重新落子）
        if (!result.skipTurn) {
          let nextPlayer = ruleConfig.switchPlayer ? ruleConfig.switchPlayer(this.data.currentPlayer) : (this.data.currentPlayer === 1 ? 2 : 1);
          this.setData({
            currentPlayer: nextPlayer,
            skillPages: this.getSkillPagesByPlayer(nextPlayer)
          });
          this.turnSkillUsed = false;
          if (this.data.gameMode === 'ai' && nextPlayer === 2 && !this.data.isGameOver) {
            setTimeout(() => { this.processAITurn(); }, 500);
          }
        }

        const skillToastTitle = (this.data.gameMode === 'ai' && skillOwner === 2)
          ? `电脑对手用了${skill.name}`
          : `使用了 ${skill.name}`;
        wx.showToast({ title: result.msg || skillToastTitle, icon: 'none' });
    } else if (result.msg) {
        wx.showToast({ title: result.msg, icon: 'none' });
    }
  },
animatePiece() {
  const duration = 200;
  const start = Date.now();

  const animate = () => {
    let elapsed = Date.now() - start;
    let progress = Math.min(elapsed / duration, 1);

    // ✅ 安全 easing（不会负数）
    const ease = 1 - Math.pow(1 - progress, 3);

    this.setData({
      animatingMove: {
        ...this.data.animatingMove,
        progress: ease
      }
    });

    this.drawBoard();

    if (elapsed < duration) {
      // ❗关键：用 setTimeout 替代
      setTimeout(animate, 16);
    } else {
      // 动画结束
      const { row, col } = this.data.animatingMove;

      let board = this.data.board;
      board[row][col] = 2;

      this.setData({
        board,
        animatingMove: null
      });

      this.drawBoard();
    }
  };

  animate();
},
  updateSkillCooldowns(player) {
    let newSkillPages = JSON.parse(JSON.stringify(this.getSkillPagesByPlayer(player)));
    for(let p = 0; p < newSkillPages.length; p++) {
        for(let s = 0; s < newSkillPages[p].length; s++) {
        if(newSkillPages[p][s].usedUp) continue;
        if(newSkillPages[p][s].cooldown > 0) newSkillPages[p][s].cooldown--;
        }
    }
    this.playerSkillPages[player] = newSkillPages;
    if (this.data.currentPlayer === player) {
      this.setData({ skillPages: newSkillPages });
    }
  },

  // === 结束 / 重开 ===
  handleWin(winner) {
    const settlementData = this.buildSettlementData(winner);
    this.saveBattleRecord(winner);
    this.setData({
      isGameOver: true,
      settlementVisible: true,
      ...settlementData
    });
  },

  saveBattleRecord(winner) {
    const now = new Date();
    const elapsedSec = Math.max(1, Math.floor((Date.now() - this.data.gameStartTime) / 1000));
    const roundCount = Math.max(1, Math.ceil(this.data.moveCount / 2));
    const isAIMode = this.data.gameMode === 'ai';

    let result = '失败';
    if (isAIMode) {
      result = winner === 1 ? '胜利' : '失败';
    } else {
      // 双人模式默认从黑棋玩家视角统计战绩
      result = winner === 1 ? '胜利' : '失败';
    }

    const record = {
      modeText: isAIMode ? '人机对战' : '双人对战',
      result,
      durationText: this.formatDuration(elapsedSec),
      roundText: `${roundCount}回合`,
      timeText: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    };

    const history = wx.getStorageSync(BATTLE_RECORDS_KEY) || [];
    history.unshift(record);
    wx.setStorageSync(BATTLE_RECORDS_KEY, history.slice(0, 30));
  },

  buildSettlementData(winner) {
    const elapsedSec = Math.max(1, Math.floor((Date.now() - this.data.gameStartTime) / 1000));
    const durationText = this.formatDuration(elapsedSec);
    const roundCount = Math.max(1, Math.ceil(this.data.moveCount / 2));
    const roundText = `${roundCount}回合`;
    const isAIMode = this.data.gameMode === 'ai';
    const aiRating = this.getBattleRating(roundCount, elapsedSec);

    if (isAIMode) {
      const victory = winner === 1;
      const aiVictoryLines = [
        '恭喜，五子棋大师！继续保持！',
        '这波布局很稳，电脑对手被你拿捏了！',
        '攻守节奏完美，漂亮拿下这一局！',
        '关键一手封杀全局，赢得干脆利落！',
        '你今天手感火热，胜利实至名归！'
      ];
      const aiDefeatLines = [
        '别灰心，下一局一定行！',
        '这局差一点点，下一盘就能翻盘！',
        '一子之失，来日可追。',
        '电脑对手抓住了破绽，再来一局复仇！',
        '思路已经对了，下一把就会更顺！'
      ];
      return {
        settlementType: victory ? 'victory' : 'defeat',
        settlementTitleEn: victory ? 'VICTORY!' : 'DEFEAT...',
        settlementTitleCn: victory ? '你赢了！' : '你输了。',
        settlementMessage: this.getRandomLine(victory ? aiVictoryLines : aiDefeatLines),
        settlementThirdLabel: victory ? '评价' : '对手',
        settlementThirdValue: victory ? aiRating : '阿尔法喵 (电脑对手)',
        settlementDurationText: durationText,
        settlementRoundText: roundText
      };
    }

    const doubleBlackWinLines = [
      '黑棋操作行云流水！',
      '黑棋节奏掌控到位，拿下胜局！',
      '黑棋中盘发力，压制到底！',
      '黑棋攻防兼备，这局赢得漂亮！',
      '黑棋关键点位精准，实至名归！'
    ];
    const doubleWhiteWinLines = [
      '白棋反击漂亮，拿下胜局！',
      '白棋布局细腻，后程发力制胜！',
      '白棋抓住机会，一波终结比赛！',
      '白棋稳扎稳打，赢得干净利落！',
      '白棋关键连线形成，漂亮获胜！'
    ];

    return {
      settlementType: winner === 1 ? 'victory' : 'defeat',
      settlementTitleEn: winner === 1 ? 'BLACK WIN!' : 'WHITE WIN!',
      settlementTitleCn: winner === 1 ? '黑棋获胜！' : '白棋获胜！',
      settlementMessage: this.getRandomLine(winner === 1 ? doubleBlackWinLines : doubleWhiteWinLines),
      settlementThirdLabel: '模式',
      settlementThirdValue: '双人对战',
      settlementDurationText: durationText,
      settlementRoundText: roundText
    };
  },

  getRandomLine(lines) {
    if (!Array.isArray(lines) || lines.length === 0) {
      return '';
    }
    const randomIndex = Math.floor(Math.random() * lines.length);
    return lines[randomIndex];
  },

  getBattleRating(roundCount, elapsedSec) {
    if (roundCount <= 8 || elapsedSec <= 60) {
      return this.getRandomLine(['神之一手', '雷霆制胜', '出神入化', '势如破竹', '算无遗策']);
    }
    if (roundCount <= 14 || elapsedSec <= 150) {
      return this.getRandomLine(['棋风凌厉', '攻守兼备', '节奏大师', '落子精准', '稳中带狠']);
    }
    if (roundCount <= 22 || elapsedSec <= 300) {
      return this.getRandomLine(['稳扎稳打', '厚积薄发', '后劲十足', '越战越勇', '大局观强']);
    }
    return this.getRandomLine(['鏖战王者', '韧性拉满', '耐心超群', '逆风翻盘', '终局大师']);
  },

  formatDuration(totalSec) {
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    if (minutes > 0) {
      return `${minutes}分${seconds}秒`;
    }
    return `${seconds}秒`;
  },

  handleSettlementRestart() {
    this._ctx = null;
    this.initGame();
    setTimeout(() => {
      this.initCanvas();
    }, 30);
  },

  handleBackToMenu() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  },

  handleAISkillToggle(e) {
    const enabled = !!e.detail.value;
    this.setData({ aiSkillEnabled: enabled });
    wx.showToast({
      title: enabled ? '已开启电脑技能' : '已关闭电脑技能',
      icon: 'none'
    });
  },

  toggleSkillHistoryPanel() {
    this.setData({ showSkillHistoryPanel: !this.data.showSkillHistoryPanel });
  },

  pushSkillHistoryRecord(skillOwner, skillName) {
    const round = Math.max(1, Math.ceil(this.data.moveCount / 2));
    let actor = '玩家';

    if (this.data.gameMode === 'double') {
      actor = skillOwner === 1 ? '玩家1' : '玩家2';
    } else {
      actor = skillOwner === 1 ? '玩家' : '电脑';
    }

    const record = {
      id: `${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      text: `R${round} ${actor} · ${skillName}`
    };

    const next = [...(this.data.skillHistory || []), record];
    const maxRecords = 18;
    const trimmed = next.length > maxRecords ? next.slice(next.length - maxRecords) : next;
    this.setData({ skillHistory: trimmed });
  },

  handleRestart() {
    this.initGame();
  }
});