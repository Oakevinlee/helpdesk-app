import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [tickets, setTickets] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTickets() {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setError(error.message)
      } else {
        setTickets(data)
      }
      setLoading(false)
    }

    fetchTickets()
  }, [])

  if (loading) return <p>Loading tickets...</p>
  if (error) return <p>Something went wrong: {error}</p>

  return (
    <div>
      <h1>Helpdesk</h1>
      {tickets.length === 0 ? (
        <p>No tickets found.</p>
      ) : (
        <ul>
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <strong>{ticket.title}</strong> ({ticket.status})
              <p>{ticket.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App