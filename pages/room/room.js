// pages/room/room.js
const PROFILE_NAME_KEY = 'profileNickname'
const PROFILE_AVATAR_KEY = 'profileAvatar'
const BATTLE_RECORDS_KEY = 'battleRecords'

Page({
  data: {
    active: true,
    nickname: '五子棋玩家',
    avatarUrl: '',
    recordList: [],
    totalGames: 0,
    winGames: 0,
    winRateText: '0%'
  },

  onLoad() {
    this.loadProfile()
    this.loadRecords()
  },

  onShow() {
    // 返回个人中心时刷新，确保能看到最新对局记录
    this.loadRecords()
  },

  loadProfile() {
    const nickname = wx.getStorageSync(PROFILE_NAME_KEY) || '五子棋玩家'
    const avatarUrl = wx.getStorageSync(PROFILE_AVATAR_KEY) || ''
    this.setData({ nickname, avatarUrl })
  },

  loadRecords() {
    const records = wx.getStorageSync(BATTLE_RECORDS_KEY) || []
    const totalGames = records.length
    const winGames = records.filter((item) => item.result === '胜利').length
    const winRate = totalGames > 0 ? Math.round((winGames / totalGames) * 100) : 0

    this.setData({
      recordList: records,
      totalGames,
      winGames,
      winRateText: `${winRate}%`
    })
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl || ''
    if (!avatarUrl) return
    this.setData({ avatarUrl })
    wx.setStorageSync(PROFILE_AVATAR_KEY, avatarUrl)
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  saveNickname() {
    const nickname = (this.data.nickname || '').trim()
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    wx.setStorageSync(PROFILE_NAME_KEY, nickname)
    wx.showToast({ title: '昵称已保存', icon: 'success' })
  },

  clearRecords() {
    if (this.data.totalGames === 0) return
    wx.showModal({
      title: '清空记录',
      content: '确定清空所有对局记录吗？',
      success: (res) => {
        if (!res.confirm) return
        wx.setStorageSync(BATTLE_RECORDS_KEY, [])
        this.loadRecords()
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  },

  goBack() {
    wx.navigateBack()
  }
})