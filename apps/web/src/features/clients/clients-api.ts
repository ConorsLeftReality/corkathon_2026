import { z } from 'zod'
import { apiRequest } from '#src/api/api-client.ts'

const clientSchema = z.object({ company_num: z.string(), added_at: z.string() })
const listSchema = z.object({ clients: z.array(clientSchema), limit: z.number().int() })
const uploadSchema = z.object({
  added: z.number().int(),
  already_listed: z.number().int(),
  skipped: z.number().int(),
})

export type Client = z.infer<typeof clientSchema>
export type ClientList = z.infer<typeof listSchema>
export type UploadResult = z.infer<typeof uploadSchema>
export type UploadMode = 'add' | 'replace'

// matches the api, cro numbers are digits only
export const COMPANY_NUMBER_PATTERN = '[0-9]{1,10}'

export function fetchClients(): Promise<ClientList> {
  return apiRequest('/api/clients', listSchema)
}

export function addClient(companyNum: string): Promise<ClientList> {
  const options = { method: 'POST', body: { company_num: companyNum } } as const
  return apiRequest('/api/clients', listSchema, options)
}

export async function removeClient(companyNum: string): Promise<void> {
  const path = `/api/clients/${encodeURIComponent(companyNum)}`
  await apiRequest(path, z.undefined(), { method: 'DELETE' })
}

export function uploadClients(file: File, mode: UploadMode): Promise<UploadResult> {
  const form = new FormData()
  form.set('file', file)
  form.set('mode', mode)
  return apiRequest('/api/clients/upload', uploadSchema, { method: 'POST', body: form })
}
