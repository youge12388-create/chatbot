import { prisma } from '../db/client'
import { matchesSessionToken } from './session-token'

export async function validateConversationSession(
  conversationId: string,
  token: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!conversationId || !token) return false

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      sessionTokenHash: true,
      sessionTokenExpiresAt: true,
    },
  })

  if (!conversation?.sessionTokenHash || !conversation.sessionTokenExpiresAt) return false
  if (conversation.sessionTokenExpiresAt <= now) return false
  return matchesSessionToken(token, conversation.sessionTokenHash)
}