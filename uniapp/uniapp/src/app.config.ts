const pages = [
  'pages/submit/index',
  'pages/records/index',
  'pages/profile/index',
  'pages/login/index',
  'pages/record-detail/index',
  'pages/record-edit/index'
]

export default defineAppConfig({
  pages,
  tabBar: {
    color: '#6b7280',
    selectedColor: '#3b82f6',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/submit/index',
        text: '报账'
      },
      {
        pagePath: 'pages/records/index',
        text: '记录'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的'
      }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '司机报账',
    navigationBarTextStyle: 'black'
  }
})
