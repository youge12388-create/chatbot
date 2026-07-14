import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDifyRequestBody,
  normalizeDifyApiUrl,
  shouldResetDifyConversation,
} from './chat'

test('Dify 首次请求使用空 conversation_id', () => {
  const body = buildDifyRequestBody('你好', null, 'local-conversation-id')

  assert.equal(body.conversation_id, '')
})

test('Dify 后续请求复用服务端返回的 conversation_id', () => {
  const body = buildDifyRequestBody('继续咨询', 'dify-conversation-id', 'local-conversation-id')

  assert.equal(body.conversation_id, 'dify-conversation-id')
  assert.equal(body.user, 'local-conversation-id')
})

test('Dify 基础地址自动补全聊天接口路径', () => {
  assert.equal(
    normalizeDifyApiUrl('https://dify.example.com'),
    'https://dify.example.com/v1/chat-messages',
  )
  assert.equal(
    normalizeDifyApiUrl('https://dify.example.com/v1/'),
    'https://dify.example.com/v1/chat-messages',
  )
  assert.equal(
    normalizeDifyApiUrl('https://dify.example.com/v1/chat-messages/'),
    'https://dify.example.com/v1/chat-messages',
  )
})

test('更换 Dify 智能体后仅对失效的旧会话重建', () => {
  assert.equal(
    shouldResetDifyConversation(404, '{"message":"Conversation Not Exists."}', 'old-id'),
    true,
  )
  assert.equal(shouldResetDifyConversation(401, 'unauthorized', 'old-id'), false)
  assert.equal(shouldResetDifyConversation(404, 'route not found', 'old-id'), false)
  assert.equal(shouldResetDifyConversation(404, 'Conversation Not Exists.', null), false)
})

