// pages/index/index.js
Page({
  startAIGame() {
    //人机对战
    wx.navigateTo({
      url: '/pages/game/game?mode=ai',
    })
  },

  startDoubleGame() {
    //双人对战
    wx.navigateTo({
      url: '/pages/game/game?mode=double',
    })
  }
})