// pages/manual/manual.js
Page({
  data: {
    skills: [
      { id: 1, name: '飞沙走石', cd: 3, desc: '选择一个对手的棋子扔出棋盘。' },
      { id: 2, name: '拾金不昧', cd: 5, desc: '将被扔走的我方棋子随机恢复到空位。' },
      { id: 3, name: '保洁上门', cd: 7, desc: '随机清理对手1-3个棋子。' },
      { id: 4, name: '擒拿擒拿', cd: 8, desc: '下回合自身获得护盾，克制对手的飞沙走石。' },
      { id: 5, name: '静如止水', cd: 10, desc: '下回合对对手造成沉默，使他全技能被封印。' },
      { id: 6, name: '时光倒流', cd: 12, desc: '不损失当前技能CD，让整个棋局时间倒回到你上一次落子前。' },
      { id: 7, name: '两级反转', cd: 999, desc: '逆天改命局势调换，将棋盘中双方所有的棋子互换。' },
      { id: 8, name: '力拔山兮', cd: 999, desc: '一局只能使用一次的清空全场，将所有棋子拔除归零。' }
    ]
  },

  onLoad() {
    // 页面加载
  },

  closeManual() {
    wx.navigateBack({ delta: 1 });
  }
});
