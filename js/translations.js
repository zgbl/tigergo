// translations.js

const formatTranslations = {
    'Single Round Robin': '单循环',
    'Double Round Robin': '双循环',
    'Swiss System': '瑞士制',
    'Knockout': '淘汰赛',
    'Other': '其他'
  };
  
  // 英文到中文的转换函数
  function getChineseFormat(englishFormat) {
    return formatTranslations[englishFormat] || englishFormat;
  }
  
  // 中文到英文的转换函数
  function getEnglishFormat(chineseFormat) {
    return Object.keys(formatTranslations).find(key => formatTranslations[key] === chineseFormat) || chineseFormat;
  }
  
  // 如果你使用 ES6 模块  ， 传统方法不需要export
  //export { formatTranslations, getChineseFormat, getEnglishFormat };
  
  // 如果你使用 CommonJS
  // module.exports = { formatTranslations, getChineseFormat, getEnglishFormat };