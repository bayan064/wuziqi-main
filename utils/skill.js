// utils/skill.js
// 技能系统核心逻辑（由C同学负责）

const getAllSkills = () => {
    return [
        { id: 1, name: '飞沙走石', maxCooldown: 3, cooldown: 0 },
        { id: 2, name: '拾金不昧', maxCooldown: 5, cooldown: 0 },
        { id: 3, name: '保洁上门', maxCooldown: 7, cooldown: 0 },
        { id: 4, name: '擒拿擒拿', maxCooldown: 8, cooldown: 0 },
        { id: 5, name: '静如止水', maxCooldown: 10, cooldown: 0 },
        { id: 6, name: '时光倒流', maxCooldown: 12, cooldown: 0 },
        { id: 7, name: '两级反转', maxCooldown: 999, cooldown: 0 },
        { id: 8, name: '力拔山兮', maxCooldown: 999, cooldown: 0 }
    ];
};

/**
 * 获取随机的三项技能
 * 供 game.js 在开局时调用
 */
const getRandomSkills = (count) => {
    // 临时为了展示所有技能，分页展示全部8个技能
    return getAllSkills();
}

/**
 * 触发某个技能效果
 * @param {Number} skillId 要释放的技能ID
 * @param {Array} board 当前15x15棋盘数据
 * @param {Number} player 释放技能的玩家(默认1，代表黑棋)
 * @param {Object} extraContext 附带数据，如外部状态或历史快照等
 * @returns {Object} { success: boolean, newBoard: Array, skipTurn: boolean, newHistory: Array }
 */
const useSkill = (skillId, board, player, extraContext = {}) => {
    
    // 深拷贝棋盘，避免污染引用
    let newBoard = JSON.parse(JSON.stringify(board));
    let success = false;
    let skipTurn = false; // 是否因特殊技能跳过后续回合移交
    let newHistory = extraContext.history ? [...extraContext.history] : [];

    // TODO: 完善十个核心技能的逻辑实现
    // 【开发步骤】：
    // 1. 使用 switch(skillId) 来区分技能逻辑。
    // 2. 比如 '飞沙走石'（移除最近落子）：遍历 board，找到最新落的 3 颗连续棋子置为 0。
    // 3. 比如 '同归于尽'：计算棋盘中心点 [7, 7] 附近的 3x3 区域，全部置为 0。
    // 4. 判断成功后返回 true，以及修改后的 newBoard 给主页面渲染。
    
    switch (skillId) {
        case 1: // 飞沙走石：选择一个对手的棋子扔出棋盘
            let oppPlayer = player === 1 ? 2 : 1;
            // 【保护判断】在使用前先检查对手是否套了盾，如果有可以直接抵消不用选人了
            if (extraContext.playerEffects && extraContext.playerEffects[oppPlayer] && extraContext.playerEffects[oppPlayer].protect > 0) {
                success = true;
                return { success, newBoard, msg: '对方被擒拿护盾保护，飞沙走石无效！' };
            }

            if (!extraContext.target) {
                // 尚未在棋盘上选择坐标，返回拦截信号
                return { requiresTarget: true };
            }
            
            let tRow = extraContext.target.row;
            let tCol = extraContext.target.col;
            let piece = newBoard[tRow][tCol];

            if (piece === oppPlayer) {
                newBoard[tRow][tCol] = 0;
                success = true;
                return { success, newBoard, removedPiece: { player: oppPlayer } };
            } else {
                return { success: false, msg: '目标不合法' };
            }
            break;

        case 2: // 拾金不昧：将被扔走的棋子随机恢复到棋盘
            let rpList = extraContext.removedPieces || [];
            // 找到属于当前施法者的被移除棋子的索引
            let myRemovedIndex = rpList.findIndex(p => p.player === player);
            
            if (myRemovedIndex === -1) {
                return { success: false, msg: '你还没有被扔出棋盘的棋子' };
            }
            
            // 找到所有的空位
            let emptyCells = [];
            for (let r = 0; r < 15; r++) {
                for (let c = 0; c < 15; c++) {
                    if (newBoard[r][c] === 0) {
                        emptyCells.push({r, c});
                    }
                }
            }
            
            if (emptyCells.length > 0) {
                // 准确取走我方被移除的棋子
                let recoveredPiece = rpList.splice(myRemovedIndex, 1)[0];
                // 随机恢复到一个空位上
                let randCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
                newBoard[randCell.r][randCell.c] = recoveredPiece.player;
                
                success = true;
                return { success, newBoard, newRemovedPieces: rpList };
            } else {
                return { success: false, msg: '棋盘满了，无法恢复' };
            }
            break;

        case 3: // 保洁上门：随机清理对手1-3个棋子
            const opponent = player === 1 ? 2 : 1;
            
            // 【保护判断】如果对手处于擒拿护盾状态
            if (extraContext.playerEffects && extraContext.playerEffects[opponent] && extraContext.playerEffects[opponent].protect > 0) {
                success = true; // 技能已施放，但是被抵消了
                return { success, newBoard, msg: '对方被擒拿护盾保护，保洁上门无效！' };
            }

            let opponentPieces = [];
            // 找出所有对手的棋子坐标
            for (let r = 0; r < 15; r++) {
                for (let c = 0; c < 15; c++) {
                    if (newBoard[r][c] === opponent) {
                        opponentPieces.push({r, c});
                    }
                }
            }
            if (opponentPieces.length > 0) {
                // 决定清理的数量 1~3但不能超过对手场上的棋子总数
                const removeCount = Math.min(Math.floor(Math.random() * 3) + 1, opponentPieces.length);
                // 随机打乱数组取出前几个坐标
                opponentPieces.sort(() => Math.random() - 0.5);
                for (let i = 0; i < removeCount; i++) {
                    const {r, c} = opponentPieces[i];
                    newBoard[r][c] = 0;
                }
            }
            success = true;
            break;

        case 4: // 擒拿擒拿：下回合克制对手的飞沙走石和保洁上门技能
            success = true;
            return { success, newBoard, applyEffect: { target: player, effect: 'protect', duration: 1 } };

        case 5: // 静如止水：禁用对手下回合的技能使用
            success = true;
            let targetSilence = player === 1 ? 2 : 1;
            return { success, newBoard, applyEffect: { target: targetSilence, effect: 'silence', duration: 1 } };

        case 6: // 时光倒流：让时间回到上一回合，且不恢复技能CD
            // 判断是否至少走过了1回合(即至少落过1次子保存了快照)
            if (newHistory && newHistory.length > 0) {
                // 退回到玩家自己上次落子前的状态
                const previousBoard = newHistory.pop();
                newBoard = JSON.parse(JSON.stringify(previousBoard));
                success = true;
                skipTurn = true; // 时光倒流后应该是自己重新落子，不把回合让给对手
            } else {
                wx.showToast({ title: '第一回合无法时光倒流', icon: 'none' });
            }
            break;
            
        case 7: // 两级反转：交换棋盘中双方的棋子
            for (let r = 0; r < 15; r++) {
                for (let c = 0; c < 15; c++) {
                    if (newBoard[r][c] === 1) {
                        newBoard[r][c] = 2;
                    } else if (newBoard[r][c] === 2) {
                        newBoard[r][c] = 1;
                    }
                }
            }
            success = true;
            break;

        case 8: // 力拔山兮：清空棋盘中所有棋子
            for (let r = 0; r < 15; r++) {
                for (let c = 0; c < 15; c++) {
                    newBoard[r][c] = 0;
                }
            }
            success = true;
            break;

        // ... (其它技能用相似的方式实现，遇到困难可以让大模型单独生成某一个特定技能的核心代码)
            
        default:
            console.log("未实现的技能，ID:", skillId);
            break;
    }

    return { success, newBoard, skipTurn, newHistory };
}

module.exports = {
    getRandomSkills,
    useSkill
}