import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import TicketDetail from './TicketDetail'

function Tickets({ session }) {
  const [tickets, setTickets] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [isAgent, setIsAgent] = useState(false)

  async function fetchTickets() {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setTickets(data)
  }

  useEffect(() => {
    fetchTickets()

    // Look up whether the logged-in user is an agent
    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setIsAgent(data?.role === 'agent'))
  }, [session.user.id])

  async function createTicket(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase
      .from('tickets')
      .insert({ title, description })

    if (error) {
      setError(error.message)
      return
    }
    setTitle('')
    setDescription('')
    fetchTickets()
  }

  // If a ticket is selected, show its detail screen instead of the list
  if (selectedTicket) {
    return (
      <TicketDetail
        ticket={selectedTicket}
        isAgent={isAgent}
        onBack={() => {
          setSelectedTicket(null)
          fetchTickets() // refresh, in case the status changed
        }}
      />
    )
  }

  return (
    <div>
      <h1>Helpdesk</h1>
      <p>
        Logged in as {session.user.email}
        {isAgent && ' (Support agent)'}{' '}
        <button onClick={() => supabase.auth.signOut()}>Log out</button>
      </p>

      {!isAgent && (
        <>
          <h2>New ticket</h2>
          <form onSubmit={createTicket}>
            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="Describe the problem"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button type="submit">Submit ticket</button>
          </form>
        </>
      )}

      {error && <p>Something went wrong: {error}</p>}

      <h2>{isAgent ? 'All tickets' : 'My tickets'}</h2>
      {tickets.length === 0 && <p>No tickets yet.</p>}
      <ul>
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <button onClick={() => setSelectedTicket(ticket)}>
              {ticket.title}
            </button>{' '}
            ({ticket.status})
            <p>{ticket.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Tickets