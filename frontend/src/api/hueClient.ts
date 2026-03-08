import type {
  HueInventoryResponse,
  HueRoomsResponse,
  RenameRoomPayload,
} from '../types/hue'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

type ApiError = {
  error?: string
}

const parseError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as ApiError
    return payload.error ?? `HTTP ${response.status}`
  } catch {
    return `HTTP ${response.status}`
  }
}

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, init)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return (await response.json()) as T
}

export const getHueInventory = (): Promise<HueInventoryResponse> =>
  requestJson<HueInventoryResponse>('/api/hue/inventory')

export const getHueDiagnostics = (): Promise<HueInventoryResponse> =>
  requestJson<HueInventoryResponse>('/api/hue/diagnostics')

export const getHueRooms = (): Promise<HueRoomsResponse> =>
  requestJson<HueRoomsResponse>('/api/hue/rooms')

export const renameHueRoom = (roomId: string, payload: RenameRoomPayload): Promise<unknown> =>
  requestJson(`/api/hue/rooms/${roomId}/name`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
