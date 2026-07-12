const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

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
        bubbleMessage: '有问题？点击这里随时咨询 👋',
        primaryColor: '#165DFF',
      },
    },
  })

  // 创建示例 FAQ
  const faqs = [
    { question: '学费是多少？', answer: '请咨询具体项目，不同课程费用不同。', priority: 1 },
    { question: '申请条件是什么？', answer: '一般需要学历证明和语言成绩，具体视项目而定。', priority: 2 },
    { question: '有奖学金吗？', answer: '部分项目提供奖学金，欢迎留下联系方式获取详情。', priority: 3 },
  ]

  // 避免重复写入
  await prisma.faq.deleteMany({ where: { siteId: site.id } })

  for (const faq of faqs) {
    await prisma.faq.create({
      data: {
        siteId: site.id,
        question: faq.question,
        answer: faq.answer,
        priority: faq.priority,
      },
    })
  }

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
  console.log(`[seed] FAQ 初始化完成`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
