import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function TicketDetail({ ticket, onBack }) {
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)

  // Add a message to the list, skipping it if it's already there
  function addMessage(newMessage) {
    setMessages((prev) =>
      prev.some((m) => m.id === newMessage.id) ? prev : [...prev, newMessage]
    )
  }

  useEffect(() => {
    // 1. Load the existing messages
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true })

      if (error) setError(error.message)
      else setMessages(data)
    }
    fetchMessages()

    // 2. Listen for new messages on this ticket, live
    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => addMessage(payload.new)
      )
      .subscribe()

    // 3. Stop listening when you leave this screen
    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticket.id])

  async function sendReply(e) {
    e.preventDefault()
    setError(null)
    const { data, error } = await supabase
      .from('messages')
      .insert({ ticket_id: ticket.id, body })
      .select()
      .single()

    if (error) {
      setError(error.message)
      return
    }
    setBody('')
    addMessage(data)
  }

  return (
    <div>
      <button onClick={onBack}>← Back to tickets</button>
      <h2>{ticket.title} ({ticket.status})</h2>
      <p>{ticket.description}</p>

      <h3>Replies</h3>
      {messages.length === 0 && <p>No replies yet.</p>}
      <ul>
        {messages.map((m) => (
          <li key={m.id}>
            <p>{m.body}</p>
            <small>{new Date(m.created_at).toLocaleString()}</small>
          </li>
        ))}
      </ul>

      <form onSubmit={sendReply}>
        <textarea
          placeholder="Write a reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        <button type="submit">Send reply</button>
      </form>

      {error && <p>Something went wrong: {error}</p>}
    </div>
  )
}

export default TicketDetail