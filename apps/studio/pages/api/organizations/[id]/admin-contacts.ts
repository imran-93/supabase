/**
 * Admin Contacts API Endpoint
 * GET /api/organizations/[id]/admin-contacts
 *
 * Returns list of admin contacts for an organization
 * Used by the admin notifier service to determine who to notify
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { AdminContact } from '@/lib/services/health-check/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminContact[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id: organizationId } = req.query

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({ error: 'Organization ID is required' })
    }

    // TODO: Query from admin_contacts table
    // const { data, error } = await supabase
    //   .from('admin_contacts')
    //   .select('*')
    //   .eq('organization_id', organizationId)
    //   .order('role', { ascending: false }) // Owners first

    // if (error) {
    //   throw error
    // }

    // Fallback: fetch organization owner from members table
    // const { data: members } = await supabase
    //   .from('organization_members')
    //   .select('user_id, role, user:profiles(email, full_name)')
    //   .eq('organization_id', organizationId)
    //   .eq('role', 'owner')

    // For now, return empty array (would be populated from DB)
    const adminContacts: AdminContact[] = []

    return res.status(200).json(adminContacts)
  } catch (error) {
    console.error('Admin contacts fetch error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch admin contacts',
    })
  }
}
