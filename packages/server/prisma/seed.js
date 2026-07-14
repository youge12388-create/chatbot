const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const DEFAULT_FAQS = [
  { question: '学费是多少？', answer: '请咨询具体项目，不同课程费用不同。', priority: 1 },
  { question: '申请条件是什么？', answer: '一般需要学历证明和语言成绩，具体视项目而定。', priority: 2 },
  { question: '有奖学金吗？', answer: '部分项目提供奖学金，欢迎留下联系方式获取详情。', priority: 3 },
]

/** 仅在站点没有 FAQ 时写入默认数据，避免服务重启覆盖后台修改。 */
async function seedDefaultFaqs(client, siteId) {
  const existingCount = await client.faq.count({ where: { siteId } })
  if (existingCount > 0) {
    console.log(`[seed] FAQ 已存在 ${existingCount} 条，保留现有数据`)
    return
  }

  await client.faq.createMany({
    data: DEFAULT_FAQS.map((faq) => ({ siteId, ...faq })),
  })
  console.log(`[seed] FAQ 初始化完成，共 ${DEFAULT_FAQS.length} 条`)
}

async function main() {
  // 创建默认站点
  const site = await prisma.site.upsert({
    where: { domain: 'localhost' },
    update: {},
    create: {
      name: '默认站点',
      domain: 'localhost',
      apiKey: 'demo-api-key-001',
      settings: {
        welcomeMessage: '您好！我是留学顾问助手，可以帮您解答院校申请、专业选择、学费奖学金等问题。有什么可以帮您的？',
        guideMessage: '您可以直接输入问题，或点击下方常见问题快速咨询。',
        bubbleMessages: [
          '有问题？点击这里随时咨询 👋',
          '免费咨询院校申请、专业选择',
          '点击聊聊，专属顾问为您服务',
        ],
        primaryColor: '#165DFF',
        contactWhatsApp: '',    // 国际格式不带+，如 8613800138000
        contactWecomQrUrl: '',  // 企微二维码图片 URL
      },
    },
  })

  // 仅为空站点创建示例 FAQ，已有内容可能已由后台维护，不能覆盖。
  await seedDefaultFaqs(prisma, site.id)

  // 创建默认管理员账号
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const existing = await prisma.adminUser.findUnique({ where: { username: adminUsername } })
  if (!existing) {
    const hashed = await bcrypt.hash(adminPassword, 10)
    await prisma.adminUser.create({
      data: { username: adminUsername, password: hashed, role: 'admin', name: '管理员' },
    })
    console.log(`[seed] 默认管理员创建成功: ${adminUsername} (请尽快修改密码)`)
  } else {
    console.log(`[seed] 管理员已存在: ${adminUsername}`)
  }

  console.log(`[seed] 站点创建成功: ${site.id}, apiKey: ${site.apiKey}`)
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

module.exports = { seedDefaultFaqs }
