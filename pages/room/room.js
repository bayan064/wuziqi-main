// pages/room/room.js
Page({
  data: {
    roomId: '',        // 房间号
    inputRoomId: '',   // 输入的房间号
    active: true
  },

  onLoad() {
    // 页面加载
    console.log('在线对战页面加载')
  },

  // 创建房间
  createRoom() {
    // 生成6位随机房间号
    const roomId = Math.floor(100000 + Math.random() * 900000).toString()
    
    this.setData({ roomId })
    
    wx.showModal({
      title: '房间创建成功',
      content: `房间号：${roomId}\n请将房间号分享给好友`,
      confirmText: '复制房间号',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: roomId,
            success: () => {
              wx.showToast({ title: '房间号已复制', icon: 'success' })
            }
          })
        }
      }
    })
    
    // 跳转到等待页面（先弹窗，后续可以再加跳转）
    // wx.navigateTo({
    //   url: `/pages/wait/wait?roomId=${roomId}&isCreator=true`
    // })
  },

  // 加入房间
  joinRoom() {
    const roomId = this.data.inputRoomId.trim()
    
    if (!roomId) {
      wx.showToast({ title: '请输入房间号', icon: 'none' })
      return
    }
    
    if (roomId.length !== 6) {
      wx.showToast({ title: '房间号应为6位数字', icon: 'none' })
      return
    }
    
    wx.showModal({
      title: '加入房间',
      content: `正在加入房间：${roomId}`,
      confirmText: '确定',
      success: (res) => {
        if (res.confirm) {
          // TODO: 后续接入后端验证房间是否存在
          wx.showToast({ title: '功能开发中', icon: 'none' })
          // wx.navigateTo({
          //   url: `/pages/wait/wait?roomId=${roomId}&isCreator=false`
          // })
        }
      }
    })
  },

  // 随机匹配（占位，逻辑先不做）
  randomMatch() {
    wx.showModal({
      title: '随机匹配',
      content: '功能开发中，敬请期待',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 输入房间号
  onRoomIdInput(e) {
    this.setData({ inputRoomId: e.detail.value })
  },

  // 返回首页
  goBack() {
    wx.navigateBack()
  }
})