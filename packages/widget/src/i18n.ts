/**
 * Widget 国际化。
 * 支持：zh-CN（中文）、en（英文）、ko（韩文）、ru（俄语）。
 */

export type Lang = 'zh-CN' | 'en' | 'ko' | 'ru'
export type LocalizedText = Partial<Record<Lang, string>>
export type LocalizedList = Partial<Record<Lang, string[]>>

export const SUPPORTED_LANGS: readonly Lang[] = ['zh-CN', 'en', 'ko', 'ru']

const translations: Record<Lang, Record<string, string>> = {
  'zh-CN': {
    'header.title': '在线咨询', 'header.welcome': '您好！有什么可以帮您的？', 'language.label': '语言', 'input.placeholder': '输入问题...', 'loading': '正在思考...', 'networkError': '网络异常，请稍后重试。',
    'contact.button': '联系顾问', 'contact.title': '联系顾问', 'contact.close': '关闭', 'contact.wechatQr': '企微二维码',
    'retain.title': '等一下！', 'retain.description': '留个手机号，我们帮您看具体方案。', 'retain.phonePlaceholder': '您的手机号码', 'retain.stillClose': '仍要关闭', 'retain.submit': '提交', 'retain.success': '收到，我们会尽快联系您。',
    'form.title': '请留下联系方式，方便我们为您服务', 'form.name': '姓名', 'form.namePlaceholder': '您的称呼', 'form.phone': '手机号', 'form.phonePlaceholder': '您的手机号码', 'form.wechat': '微信号（选填）', 'form.wechatPlaceholder': '微信号', 'form.education': '当前学历', 'form.educationPlaceholder': '如：本科、大专、高中', 'form.major': '意向专业（选填）', 'form.majorPlaceholder': '您想申请的专业', 'form.submit': '提交', 'form.cancel': '稍后再说', 'form.selectPlaceholder': '请选择', 'form.required': '请填写完整信息', 'form.invalidPhone': '手机号格式不正确', 'form.invalidEmail': '邮箱格式不正确', 'form.success': '信息已收到，我们会尽快联系您。', 'transfer.reply': '已将您的需求转给专业顾问，稍后会联系您。',
  },
  en: {
    'header.title': 'Online Support', 'header.welcome': 'Hello! How can I help you?', 'language.label': 'Language', 'input.placeholder': 'Type your question...', 'loading': 'Thinking...', 'networkError': 'Network error, please try again.',
    'contact.button': 'Contact consultant', 'contact.title': 'Contact consultant', 'contact.close': 'Close', 'contact.wechatQr': 'WeChat QR code',
    'retain.title': 'Wait!', 'retain.description': 'Leave your phone number and we will help you with a study plan.', 'retain.phonePlaceholder': 'Your phone number', 'retain.stillClose': 'Still close', 'retain.submit': 'Submit', 'retain.success': 'Got it. We will contact you soon.',
    'form.title': 'Please leave your contact information', 'form.name': 'Name', 'form.namePlaceholder': 'Your name', 'form.phone': 'Phone', 'form.phonePlaceholder': 'Your phone number', 'form.wechat': 'WeChat (optional)', 'form.wechatPlaceholder': 'WeChat ID', 'form.education': 'Education', 'form.educationPlaceholder': 'e.g. Bachelor, Diploma, High School', 'form.major': 'Intended major (optional)', 'form.majorPlaceholder': 'Your intended major', 'form.submit': 'Submit', 'form.cancel': 'Later', 'form.selectPlaceholder': 'Please select', 'form.required': 'This field is required', 'form.invalidPhone': 'Invalid phone format', 'form.invalidEmail': 'Invalid email format', 'form.success': "We've received your information. We'll contact you soon.", 'transfer.reply': 'Your request has been forwarded to a consultant. We will contact you shortly.',
  },
  ko: {
    'header.title': '온라인 상담', 'header.welcome': '안녕하세요! 무엇을 도와드릴까요?', 'language.label': '언어', 'input.placeholder': '질문을 입력하세요...', 'loading': '답변을 준비하고 있습니다...', 'networkError': '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    'contact.button': '상담원에게 문의', 'contact.title': '상담원에게 문의', 'contact.close': '닫기', 'contact.wechatQr': 'WeChat QR 코드',
    'retain.title': '잠시만요!', 'retain.description': '전화번호를 남겨 주시면 맞춤 상담을 도와드리겠습니다.', 'retain.phonePlaceholder': '전화번호', 'retain.stillClose': '그래도 닫기', 'retain.submit': '제출', 'retain.success': '확인했습니다. 곧 연락드리겠습니다.',
    'form.title': '상담을 위해 연락처를 남겨 주세요', 'form.name': '이름', 'form.namePlaceholder': '이름을 입력하세요', 'form.phone': '전화번호', 'form.phonePlaceholder': '전화번호를 입력하세요', 'form.wechat': 'WeChat (선택)', 'form.wechatPlaceholder': 'WeChat ID', 'form.education': '현재 학력', 'form.educationPlaceholder': '예: 학사, 석사, 고등학교', 'form.major': '희망 전공 (선택)', 'form.majorPlaceholder': '희망 전공을 입력하세요', 'form.submit': '제출', 'form.cancel': '나중에', 'form.selectPlaceholder': '선택해 주세요', 'form.required': '필수 항목입니다', 'form.invalidPhone': '전화번호 형식이 올바르지 않습니다', 'form.invalidEmail': '이메일 형식이 올바르지 않습니다', 'form.success': '정보가 접수되었습니다. 곧 연락드리겠습니다.', 'transfer.reply': '요청을 전문 상담원에게 전달했습니다. 곧 연락드리겠습니다.',
  },
  ru: {
    'header.title': 'Онлайн-консультация', 'header.welcome': 'Здравствуйте! Чем я могу помочь?', 'language.label': 'Язык', 'input.placeholder': 'Введите вопрос...', 'loading': 'Готовлю ответ...', 'networkError': 'Ошибка сети. Попробуйте ещё раз позже.',
    'contact.button': 'Связаться с консультантом', 'contact.title': 'Связаться с консультантом', 'contact.close': 'Закрыть', 'contact.wechatQr': 'QR-код WeChat',
    'retain.title': 'Подождите!', 'retain.description': 'Оставьте номер телефона, и мы поможем подобрать план обучения.', 'retain.phonePlaceholder': 'Ваш номер телефона', 'retain.stillClose': 'Всё равно закрыть', 'retain.submit': 'Отправить', 'retain.success': 'Понятно. Мы скоро свяжемся с вами.',
    'form.title': 'Оставьте контактные данные', 'form.name': 'Имя', 'form.namePlaceholder': 'Ваше имя', 'form.phone': 'Телефон', 'form.phonePlaceholder': 'Ваш номер телефона', 'form.wechat': 'WeChat (необязательно)', 'form.wechatPlaceholder': 'WeChat ID', 'form.education': 'Образование', 'form.educationPlaceholder': 'например: бакалавриат, магистратура, школа', 'form.major': 'Желаемая специальность (необязательно)', 'form.majorPlaceholder': 'Ваша специальность', 'form.submit': 'Отправить', 'form.cancel': 'Позже', 'form.selectPlaceholder': 'Выберите', 'form.required': 'Заполните обязательное поле', 'form.invalidPhone': 'Неверный формат телефона', 'form.invalidEmail': 'Неверный формат email', 'form.success': 'Мы получили ваши данные и скоро свяжемся с вами.', 'transfer.reply': 'Ваш запрос передан консультанту. Мы свяжемся с вами в ближайшее время.',
  },
}

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && SUPPORTED_LANGS.includes(value as Lang)
}

/** 将外部语言代码规范化为 Widget 内部支持的语言。 */
export function normalizeLang(value: unknown, fallback: Lang = 'zh-CN'): Lang {
  if (isLang(value)) return value
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (normalized.startsWith('zh')) return 'zh-CN'
    if (normalized.startsWith('en')) return 'en'
    if (normalized.startsWith('ko')) return 'ko'
    if (normalized.startsWith('ru')) return 'ru'
  }
  return fallback
}

/** 从旧字符串或新的按语言对象中读取当前语言文案。 */
export function resolveText(value: string | LocalizedText | undefined, lang: Lang, fallback = ''): string {
  if (typeof value === 'string') return value.trim() || fallback
  if (!value || typeof value !== 'object') return fallback
  return value[lang]?.trim() || value.en?.trim() || value['zh-CN']?.trim() || fallback
}

/** 从旧数组或新的按语言数组对象中读取当前语言文案。 */
export function resolveList(value: string[] | LocalizedList | undefined, lang: Lang): string[] {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
  if (!value || typeof value !== 'object') return []
  const list = value[lang] || value.en || value['zh-CN'] || []
  return Array.isArray(list) ? list.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()) : []
}

/** 检测语言：data-lang > 宿主页面 html lang > 浏览器语言 > 中文。 */
export function detectLang(): Lang {
  const script = document.querySelector('script[data-site-id]')
  const explicit = script?.getAttribute('data-lang')
  if (explicit) return normalizeLang(explicit)
  const htmlLang = document.documentElement.lang
  if (htmlLang) return normalizeLang(htmlLang)
  return normalizeLang(navigator.language)
}

/** 获取翻译。缺少单条翻译时回退到中文，再回退为 key。 */
export function t(lang: Lang, key: string): string {
  return translations[lang]?.[key] || translations['zh-CN'][key] || key
}
