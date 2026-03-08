export type HueInventoryRow = {
  deviceId: string
  deviceName: string | null
  lightRid: string | null
  lightName: string | null
  roomId: string | null
  roomName: string | null
  zigbeeStatus: string | null
  missingLightResource: boolean
}

export type HueInventoryResponse = {
  data: HueInventoryRow[]
}

export type HueRoom = {
  id: string
  metadata?: {
    name?: string
  }
}

export type HueRoomsResponse = {
  data: HueRoom[]
}

export type RenameRoomPayload = {
  name: string
}
