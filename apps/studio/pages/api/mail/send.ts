/**
 * Mail Sending API Endpoint
 * POST /api/mail/send
 *
 * Sends transactional emails with idempotency support
 * Used by the admin notification system and other services
 */

import type { NextApiRequest, NextApiResponse } from 'next'

interface SendMailRequest {
  to: string
  subject: string
  htmlBody: string
  plainTextBody: string
  idempotencyKey?: string
}

interface SendMailResponse {
  success: boolean
  messageId?: string
  error?: string
}

// In-memory store for idempotency keys (in production, use Redis/database)
const idempotencyStore = new Map<string, { messageId: string; timestamp: number }>()
const IDEMPOTENCY_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Check if request has already been processed
 */
function getIdempotencyResult(key: string): string | null {
  const result = idempotencyStore.get(key)
  if (!result) return null

  // Check if expired
  if (Date.now() - result.timestamp > IDEMPOTENCY_EXPIRY_MS) {
    idempotencyStore.delete(key)
    return null
  }

  return result.messageId
}

/**
 * Store idempotency result
 */
function storeIdempotencyResult(key: string, messageId: string): void {
  idempotencyStore.set(key, {
    messageId,
    timestamp: Date.now(),
  })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SendMailResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { to, subject, htmlBody, plainTextBody, idempotencyKey } = req.body as SendMailRequest

    // Validate required fields
    if (!to || !subject || (!htmlBody && !plainTextBody)) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, and (htmlBody or plainTextBody)',
      })
    }

    // Validate email format
    if (!isValidEmail(to)) {
      return res.status(400).json({ error: 'Invalid email address' })
    }

    // Check idempotency
    if (idempotencyKey) {
      const existingMessageId = getIdempotencyResult(idempotencyKey)
      if (existingMessageId) {
        return res.status(200).json({
          success: true,
          messageId: existingMessageId,
        })
      }
    }

    // TODO: Send email using configured email service
    // Options:
    // 1. Supabase Edge Functions (Deno)
    // 2. SendGrid API
    // 3. Mailgun API
    // 4. AWS SES
    // 5. Postmark

    const messageId = generateMessageId()

    // Simulate email sending
    console.log(`[EMAIL] Sending to ${to}`)
    console.log(`[EMAIL] Subject: ${subject}`)
    console.log(`[EMAIL] Message ID: ${messageId}`)

    // Store for idempotency
    if (idempotencyKey) {
      storeIdempotencyResult(idempotencyKey, messageId)
    }

    return res.status(200).json({
      success: true,
      messageId,
    })
  } catch (error) {
    console.error('Mail sending error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    })
  }
}

/**
 * Basic email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
