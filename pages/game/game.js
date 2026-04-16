// pages/game/game.js

import { drawBoard, getBoardPosition } from '../../utils/board.js';
const boardConfig = require('../../utils/board.js')//新增
const ruleConfig = require('../../utils/rule.js')
const skillConfig = require('../../utils/skill.js')
const aiConfig = require('../../utils/ai.js')

Page({
  data: {
    board: [],
    currentPlayer: 1,
    isGameOver: false,
    skills: [],
    canvasSize: 600,
    gameMode: 'ai',
    lastAIMove: null,
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
    settlementRoundText: '0回合'
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

    // 1. 获取一个空的 15x15 棋盘 (调用外部模块)
    const newBoard = ruleConfig.resetGame ? ruleConfig.resetGame() : this._createEmptyBoard();
    
    const newSkills = skillConfig.getRandomSkills ? skillConfig.getRandomSkills(3) : [];

    const skillPages = [];
    for (let i = 0; i < newSkills.length; i += 3) {
      skillPages.push(newSkills.slice(i, i + 3));
    }

    this.setData({
      board: newBoard,
      currentPlayer: 1,
      isGameOver: false,
      skills: newSkills,
      skillPages: skillPages,
      lastAIMove: null,
      animatingMove: null,
      pendingSkill: null,
      moveCount: 0,
      gameStartTime: Date.now(),
      settlementVisible: false,
      settlementRoundText: '0回合'
    });

    if (this._ctx) {
      this.drawBoard();
    }
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

    // 如果是玩家(黑)落子，在真正改变棋盘前记录当前快照（用于时光倒流）
    if (player === 1) {
        if (!this.boardHistory) this.boardHistory = [];
        this.boardHistory.push(JSON.parse(JSON.stringify(board)));
    }

    board[row][col] = player;
    const nextMoveCount = this.data.moveCount + 1;
    this.setData({ moveCount: nextMoveCount });

    // ✅ AI 落子 → 启动动画
    if (player === 2) {
      this.setData({
        animatingMove: { row, col, progress: 0 },
        lastAIMove: { row, col }
      });
      this.animatePiece(); // 启动动画
    } else {
      this.setData({ board });
      this.drawBoard();
    }

    // ===== 胜负判断 =====
    if (ruleConfig.checkWin && ruleConfig.checkWin(board, row, col)) {
      this.handleWin(player);
      return;
    }

    if (player === 1) {
      this.updateSkillCooldowns();
    }

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
  this.setData({ currentPlayer: nextPlayer });

// 【修改】人机模式且轮到AI时，才调用AI落子
if (this.data.gameMode === 'ai' && nextPlayer === 2 && !this.data.isGameOver) {
   setTimeout(() => {
       this.processAITurn();
   }, 500);
}
// 双人模式：什么都不做，等另一个玩家点击
  },


  processAITurn() {
    if(aiConfig.getAIMove) {
        let aiMove = aiConfig.getAIMove(this.data.board);
        if(aiMove) {
            this.processMove(aiMove.row, aiMove.col);
        }
    }
  },

  // === 技能 ===
  handleSkillClick(e) {
    if (this.data.isGameOver || this.data.currentPlayer !== 1) return;
    
    // 如果已经处于选中技能状态，再次点击取消
    if (this.data.pendingSkill) {
        this.setData({ pendingSkill: null });
        wx.showToast({ title: '已取消技能目标选择', icon: 'none' });
        return;
    }

    let pObj = this.getSkillInfoFromEvent(e);
    if(!pObj) return;
    let { index, skill } = pObj;

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
    // index是摊平后的index，在pages里找
    let globalIndex = 0;
    let targetSkill = null;
    for(let page of this.data.skillPages) {
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

    let extraContext = { history: this.boardHistory, removedPieces: this.removedPieces, playerEffects: this.playerEffects };
    if (extraTargetInfo) { extraContext = Object.assign(extraContext, extraTargetInfo); }

    let result = skillConfig.useSkill(skill.id, this.data.board, this.data.currentPlayer, extraContext);
    
    if (result.requiresTarget) {
        wx.showToast({ title: '请在棋盘上点击目标棋子', icon: 'none' });
        this.setData({ pendingSkill: { index, skill } });
        return;
    }

    if(result.success) {
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

        // 更新冷却，注意这里要更新 skillPages 里的对象
        let newSkillPages = JSON.parse(JSON.stringify(this.data.skillPages));
        let gIndex = 0;
        for(let p = 0; p < newSkillPages.length; p++) {
            for(let s = 0; s < newSkillPages[p].length; s++) {
                if (gIndex === index) {
                    newSkillPages[p][s].cooldown = skill.maxCooldown;
                }
                gIndex++;
            }
        }
        
        this.setData({ 
            board: result.newBoard, // 技能改变了棋盘
            skillPages: newSkillPages 
        });
        this.drawBoard();

        // 附带胜负判断(某些破坏技能可能直接赢了)
        // 如果没赢，且此技能不需要将回合连续留给自己（比如时光倒流/或者待确定的技能），将回合让给AI
        if (!result.skipTurn) {
            let nextPlayer = ruleConfig.switchPlayer ? ruleConfig.switchPlayer(this.data.currentPlayer) : 2;
            this.setData({ currentPlayer: nextPlayer });
            setTimeout(() => { this.processAITurn(); }, 500);
        }

        wx.showToast({ title: `使用了 ${skill.name}`, icon: 'success' });
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
  updateSkillCooldowns() {
    let newSkillPages = JSON.parse(JSON.stringify(this.data.skillPages));
    for(let p = 0; p < newSkillPages.length; p++) {
        for(let s = 0; s < newSkillPages[p].length; s++) {
            if(newSkillPages[p][s].cooldown > 0) newSkillPages[p][s].cooldown--;
        }
    }
    this.setData({ skillPages: newSkillPages });
  },

  // === 结束 / 重开 ===
  handleWin(winner) {
    const settlementData = this.buildSettlementData(winner);
    this.setData({
      isGameOver: true,
      settlementVisible: true,
      ...settlementData
    });
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
        '这波布局很稳，AI被你拿捏了！',
        '攻守节奏完美，漂亮拿下这一局！',
        '关键一手封杀全局，赢得干脆利落！',
        '你今天手感火热，胜利实至名归！'
      ];
      const aiDefeatLines = [
        '别灰心，下一局一定行！',
        '这局差一点点，下一盘就能翻盘！',
        '一子之失，来日可追。',
        'AI抓住了破绽，再来一局复仇！',
        '思路已经对了，下一把就会更顺！'
      ];
      return {
        settlementType: victory ? 'victory' : 'defeat',
        settlementTitleEn: victory ? 'VICTORY!' : 'DEFEAT...',
        settlementTitleCn: victory ? '你赢了！' : '你输了。',
        settlementMessage: this.getRandomLine(victory ? aiVictoryLines : aiDefeatLines),
        settlementThirdLabel: victory ? '评价' : '对手',
        settlementThirdValue: victory ? aiRating : '阿尔法喵 (AI)',
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

  handleRestart() {
    this.initGame();
  }
});