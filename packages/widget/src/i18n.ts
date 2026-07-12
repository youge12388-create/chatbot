/**
 * 国际化翻译模块
 * 支持：zh-CN（中文）/ en（英文）/ ru（俄语）
 *
 * 语言检测优先级：
 * 1. script 标签 data-lang 属性
 * 2. 浏览器语言 (navigator.language)
 * 3. 默认中文
 */

export type Lang = 'zh-CN' | 'en' | 'ru'

const translations: Record<Lang, Record<string, string>> = {
  'zh-CN': {
    'header.title': '在线咨询',
    'header.welcome': '您好！有什么可以帮您的？',
    'input.placeholder': '输入问题...',
    'loading': '正在思考...',
    'networkError': '网络异常，请稍后重试。',
    'form.title': '请留下联系方式，方便我们为您服务',
    'form.name': '姓名',
    'form.namePlaceholder': '您的称呼',
    'form.phone': '手机号',
    'form.phonePlaceholder': '您的手机号码',
    'form.wechat': '微信号（选填）',
    'form.wechatPlaceholder': '微信号',
    'form.education': '当前学历',
    'form.educationPlaceholder': '如：本科、大专、高中',
    'form.major': '意向专业（选填）',
    'form.majorPlaceholder': '您想申请的专业',
    'form.submit': '提交',
    'form.cancel': '稍后再说',
    'form.success': '信息已收到，我们会尽快联系您。',
    'transfer.reply': '已将您的需求转给专业顾问，稍后会联系您。',
  },
  'en': {
    'header.title': 'Online Support',
    'header.welcome': 'Hello! How can I help you?',
    'input.placeholder': 'Type your question...',
    'loading': 'Thinking...',
    'networkError': 'Network error, please try again.',
    'form.title': 'Please leave your contact info',
    'form.name': 'Name',
    'form.namePlaceholder': 'Your name',
    'form.phone': 'Phone',
    'form.phonePlaceholder': 'Your phone number',
    'form.wechat': 'WeChat (optional)',
    'form.wechatPlaceholder': 'WeChat ID',
    'form.education': 'Education',
    'form.educationPlaceholder': 'e.g. Bachelor, Diploma, High School',
    'form.major': 'Intended Major (optional)',
    'form.majorPlaceholder': 'Your intended major',
    'form.submit': 'Submit',
    'form.cancel': 'Later',
    'form.success': "We've received your info, we'll contact you soon.",
    'transfer.reply': 'Your request has been forwarded to a consultant.',
  },
  'ru': {
    'header.title': 'Онлайн консультация',
    'header.welcome': 'Здравствуйте! Чем я могу помочь?',
    'input.placeholder': 'Введите вопрос...',
    'loading': 'Думаю...',
    'networkError': 'Ошибка сети, попробуйте позже.',
    'form.title': 'Оставьте контактные данные',
    'form.name': 'Имя',
    'form.namePlaceholder': 'Ваше имя',
    'form.phone': 'Телефон',
    'form.phonePlaceholder': 'Ваш номер телефона',
    'form.wechat': 'WeChat (необязательно)',
    'form.wechatPlaceholder': 'WeChat ID',
    'form.education': 'Образование',
    'form.educationPlaceholder': 'например: Бакалавр, Диплом, Школа',
    'form.major': 'Специальность (необязательно)',
    'form.majorPlaceholder': 'Ваша специальность',
    'form.submit': 'Отправить',
    'form.cancel': 'Позже',
    'form.success': 'Мы получили ваши данные, скоро свяжемся.',
    'transfer.reply': 'Ваш запрос передан консультанту.',
  },
}

/**
 * 检测语言
 * 优先级：data-lang > 网站 html lang > 浏览器语言 > 默认中文
 */
export function detectLang(): Lang {
  // 1. script 标签显式指定（最高优先级）
  const script = document.querySelector('script[data-site-id]')
  const langAttr = script?.getAttribute('data-lang')
  if (langAttr === 'zh-CN' || langAttr === 'en' || langAttr === 'ru') {
    return langAttr
  }

  // 2. 宿主网站的 <html lang="..."> 属性
  const htmlLang = document.documentElement.lang?.toLowerCase()
  if (htmlLang) {
    if (htmlLang.startsWith('zh')) return 'zh-CN'
    if (htmlLang.startsWith('ru')) return 'ru'
    if (htmlLang.startsWith('en')) return 'en'
  }

  // 3. 浏览器语言
  const browserLang = navigator.language
  if (browserLang.startsWith('zh')) return 'zh-CN'
  if (browserLang.startsWith('ru')) return 'ru'
  if (browserLang.startsWith('en')) return 'en'

  // 4. 默认中文
  return 'zh-CN'
}

/** 获取翻译 */
export function t(lang: Lang, key: string): string {
  return translations[lang]?.[key] || translations['zh-CN'][key] || key
}