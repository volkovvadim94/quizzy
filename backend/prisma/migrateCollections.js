import pkg from '@prisma/client'

const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function ensureDefaultCollections() {
  const topics = await prisma.topic.findMany({ select: { id: true, name: true, slug: true } })

  for (const topic of topics) {
    const defaultSlug = 'mix-basic'
    const existing = await prisma.collection.findFirst({
      where: { topicId: topic.id, slug: defaultSlug },
      select: { id: true },
    })

    const collection =
      existing ||
      (await prisma.collection.create({
        data: {
          topicId: topic.id,
          name: 'Микс Базовый',
          slug: defaultSlug,
          isFree: true,
        },
        select: { id: true },
      }))

    const unlinked = await prisma.question.findMany({
      where: { topicId: topic.id, collections: { none: {} } },
      select: { id: true },
    })

    if (unlinked.length) {
      await prisma.collection.update({
        where: { id: collection.id },
        data: { questions: { connect: unlinked.map((q) => ({ id: q.id })) } },
      })
    }
  }
}

async function main() {
  try {
    await ensureDefaultCollections()
    console.log('Collections migration: OK')
  } catch (e) {
    console.error('Collections migration failed:', e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (String(process.argv[1] || '').toLowerCase().endsWith('migratecollections.js')) {
  main()
}

export default main
