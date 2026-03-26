interface SessionFilterProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: 'all' | 'active' | 'inactive'
  onStatusChange: (value: 'all' | 'active' | 'inactive') => void
}

export function SessionFilter({ search, onSearchChange, statusFilter, onStatusChange }: SessionFilterProps) {
  return (
    <div style={{ padding: '0 12px 12px' }}>
      <input
        type="text"
        placeholder="Search sessions..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pzl-input"
        style={{ marginBottom: 8 }}
      />
      <div className="pzl-tabs" style={{ padding: 3 }}>
        {(['all', 'active', 'inactive'] as const).map((status) => (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            className={`pzl-tab ${statusFilter === status ? 'pzl-tab-active' : ''}`}
            style={{ flex: 1, fontSize: 11, padding: '5px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {status}
          </button>
        ))}
      </div>
    </div>
  )
}
