const { PrismaClient } = require('@prisma/client')

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
        welcomeMessage: '你好，有什么可以帮您？',
        primaryColor: '#1677ff',
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
