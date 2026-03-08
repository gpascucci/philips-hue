import { useEffect, useMemo, useState } from 'react'
import './App.css'

function App() {
  const [inventory, setInventory] = useState([])
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState('all')
  const [sortBy, setSortBy] = useState('lightName')
  const [roomToRename, setRoomToRename] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

  const loadData = (showLoading = false) => {
    if (showLoading) {
      setLoading(true)
    }
    setError('')

    return Promise.all([
      fetch(`${apiBaseUrl}/api/hue/inventory`),
      fetch(`${apiBaseUrl}/api/hue/rooms`),
    ])
      .then(async ([inventoryResponse, roomsResponse]) => {
        const [inventoryPayload, roomsPayload] = await Promise.all([
          inventoryResponse.json(),
          roomsResponse.json(),
        ])
        if (!inventoryResponse.ok) {
          throw new Error(inventoryPayload.error || `HTTP ${inventoryResponse.status}`)
        }
        if (!roomsResponse.ok) {
          throw new Error(roomsPayload.error || `HTTP ${roomsResponse.status}`)
        }
        setInventory(inventoryPayload.data || [])
        setRooms(roomsPayload.data || [])
      })
      .catch((requestError) => {
        setError(`Could not load Hue data: ${requestError.message}`)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData(true)
  }, [])

  const lightRows = useMemo(() => inventory.filter((row) => row.lightRid), [inventory])

  const roomCatalog = useMemo(() => {
    const rows = rooms
      .map((room) => ({ id: room.id, name: room?.metadata?.name || room.id }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return rows
  }, [rooms])

  const filterOptions = useMemo(() => {
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

    const getSortableName = (row, field) => (row[field] || '').toString().toLowerCase()
    rows.sort((a, b) => getSortableName(a, sortBy).localeCompare(getSortableName(b, sortBy)))
    return rows
  }, [lightRows, selectedRoom, sortBy])

  const handleRenameRoom = (event) => {
    event.preventDefault()
    setSaveMessage('')
    if (!roomToRename || !newRoomName.trim()) {
      setSaveMessage('Pick a room and enter a new name.')
      return
    }

    setSaving(true)
    fetch(`${apiBaseUrl}/api/hue/rooms/${roomToRename}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoomName.trim() }),
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || `HTTP ${response.status}`)
        }
        setSaveMessage('Room name updated.')
        setNewRoomName('')
        return loadData()
      })
      .catch((saveError) => {
        setSaveMessage(`Update failed: ${saveError.message}`)
      })
      .finally(() => {
        setSaving(false)
      })
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
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="lightName">Light name</option>
                <option value="deviceName">Device name</option>
                <option value="roomName">Room name</option>
                <option value="zigbeeStatus">Zigbee status</option>
              </select>
            </label>
          </section>
          <form className="renameRoom" onSubmit={handleRenameRoom}>
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
                      <td colSpan="5">No lights match the selected room.</td>
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
