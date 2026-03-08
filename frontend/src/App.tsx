import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { getHueDiagnostics, getHueRooms, renameHueRoom } from './api/hueClient'
import type { HueInventoryRow, HueRoom } from './types/hue'
import './App.css'

type RoomOption = {
  id: string
  name: string
}

type SortField = 'lightName' | 'deviceName' | 'roomName' | 'zigbeeStatus'

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'lightName', label: 'Light name' },
  { value: 'deviceName', label: 'Device name' },
  { value: 'roomName', label: 'Room name' },
  { value: 'zigbeeStatus', label: 'Zigbee status' },
]

const getRoomName = (room: HueRoom): string => room.metadata?.name || room.id

function App() {
  const [inventory, setInventory] = useState<HueInventoryRow[]>([])
  const [rooms, setRooms] = useState<HueRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortField>('lightName')
  const [roomToRename, setRoomToRename] = useState<string>('')
  const [newRoomName, setNewRoomName] = useState<string>('')
  const [saveMessage, setSaveMessage] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  const loadData = useCallback(async (showLoading = false): Promise<void> => {
    if (showLoading) {
      setLoading(true)
    }
    setError('')

    try {
      const [inventoryPayload, roomsPayload] = await Promise.all([
        getHueDiagnostics(),
        getHueRooms(),
      ])
      setInventory(inventoryPayload.data || [])
      setRooms(roomsPayload.data || [])
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unknown error'
      setError(`Could not load Hue data: ${message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData(true)
  }, [loadData])

  const lightRows = useMemo(() => inventory.filter((row) => row.lightRid), [inventory])

  const roomCatalog = useMemo<RoomOption[]>(() => {
    return rooms
      .map((room) => ({ id: room.id, name: getRoomName(room) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rooms])

  const filterOptions = useMemo<RoomOption[]>(() => {
    return [
      { id: 'all', name: 'All rooms' },
      { id: 'unassigned', name: 'Unassigned' },
      ...roomCatalog,
    ]
  }, [roomCatalog])

  const filteredRows = useMemo(() => {
    const rows = [...lightRows].filter((row) => {
      if (selectedRoom === 'all') return true
      if (selectedRoom === 'unassigned') return !row.roomId
      return row.roomId === selectedRoom
    })

    const getSortableValue = (row: HueInventoryRow, field: SortField): string => {
      const value = row[field]
      return value ? String(value).toLowerCase() : ''
    }

    rows.sort((a, b) => getSortableValue(a, sortBy).localeCompare(getSortableValue(b, sortBy)))
    return rows
  }, [lightRows, selectedRoom, sortBy])

  const handleRenameRoom = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSaveMessage('')

    if (!roomToRename || !newRoomName.trim()) {
      setSaveMessage('Pick a room and enter a new name.')
      return
    }

    setSaving(true)
    try {
      await renameHueRoom(roomToRename, { name: newRoomName.trim() })
      setSaveMessage('Room name updated.')
      setNewRoomName('')
      await loadData()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unknown error'
      setSaveMessage(`Update failed: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="app">
      <h1>Hue Bridge Dashboard</h1>
      <p className="subtext">Inventory view for lights with room filter + sorting.</p>
      {loading && <p className="message">Loading Hue resources...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <>
          <section className="controls">
            <label>
              Room
              <select value={selectedRoom} onChange={(event) => setSelectedRoom(event.target.value)}>
                {filterOptions.map((roomOption) => (
                  <option key={roomOption.id} value={roomOption.id}>
                    {roomOption.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortField)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <form className="renameRoom" onSubmit={(event) => void handleRenameRoom(event)}>
            <label>
              Edit Room Name
              <select value={roomToRename} onChange={(event) => setRoomToRename(event.target.value)}>
                <option value="">Choose a room</option>
                {roomCatalog.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              New Name
              <input
                value={newRoomName}
                onChange={(event) => setNewRoomName(event.target.value)}
                placeholder="e.g. Front Patio"
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            {saveMessage && <span className="saveMessage">{saveMessage}</span>}
          </form>
          <section className="inventory">
            <h3>Device Inventory</h3>
            <p className="subtext">Showing {filteredRows.length} lights</p>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Device</th>
                    <th>Light</th>
                    <th>Zigbee</th>
                    <th>Reachable</th>
                    <th>Firmware</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.deviceId}>
                      <td>{row.roomName || 'Unassigned'}</td>
                      <td>{row.deviceName || row.deviceId}</td>
                      <td>{row.lightName || row.lightRid || 'Unknown light'}</td>
                      <td>{row.zigbeeStatus || 'unknown'}</td>
                      <td>{row.reachable === null ? 'unknown' : row.reachable ? 'yes' : 'no'}</td>
                      <td>
                        {row.swupdateState || 'unknown'}
                        {row.swupdateLastInstall ? ` (${row.swupdateLastInstall})` : ''}
                      </td>
                      <td>
                        {row.missingLightResource ? (
                          <span className="badge warn">Missing light resource</span>
                        ) : (
                          <span className="badge ok">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={7}>No lights match the selected room.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  )
}

export default App
