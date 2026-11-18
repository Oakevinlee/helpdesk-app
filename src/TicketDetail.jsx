import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Attachment from './Attachment'

function TicketDetail({ ticket, isAgent, onBack }) {
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [file, setFile] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState(ticket.status)
  const [error, setError] = useState(null)

  // Add a message to the list, skipping it if it's already there
  function addMessage(newMessage) {
    setMessages((prev) =>
      prev.some((m) => m.id === newMessage.id) ? prev : [...prev, newMessage]
    )
  }

  useEffect(() => {
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticket.id}`,
        },
        (payload) => setStatus(payload.new.status)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticket.id])

  // Agents only: change the ticket's status
  async function updateStatus(newStatus) {
    setError(null)
    const { data, error } = await supabase
      .from('tickets')
      .update({ status: newStatus })
      .eq('id', ticket.id)
      .select('id')

    if (error) {
      setError(error.message)
      return
    }
    // If RLS blocked the update, no error comes back — just zero rows
    if (data.length === 0) {
      setError('Status was not updated: you do not have permission.')
      return
    }
    setStatus(newStatus)
  }

  async function sendReply(e) {
    e.preventDefault()
    setError(null)
    setSending(true)

    let attachment_path = null

    // 1. If there's a file, upload it to Storage first
    if (file) {
      const { data: { session } } = await supabase.auth.getSession()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${session.user.id}/${ticket.id}/${Date.now()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(path, file)

      if (uploadError) {
        setError(uploadError.message)
        setSending(false)
        return
      }
      attachment_path = path
    }

    // 2. Save the reply, including where the file lives
    const { data, error } = await supabase
      .from('messages')
      .insert({ ticket_id: ticket.id, body, attachment_path })
      .select()
      .single()

    setSending(false)
    if (error) {
      setError(error.message)
      return
    }
    setBody('')
    setFile(null)
    setFileInputKey((k) => k + 1) // clears the file picker
    addMessage(data)
  }

  return (
    <div>
      <button onClick={onBack}>← Back to tickets</button>
      <h2>{ticket.title}</h2>

      {isAgent ? (
        <label>
          Status:{' '}
          <select value={status} onChange={(e) => updateStatus(e.target.value)}>
            <option value="open">open</option>
            <option value="in progress">in progress</option>
            <option value="closed">closed</option>
          </select>
        </label>
      ) : (
        <p>Status: {status}</p>
      )}

      <p>{ticket.description}</p>

      <h3>Replies</h3>
      {messages.length === 0 && <p>No replies yet.</p>}
      <ul>
        {messages.map((m) => (
          <li key={m.id}>
            <strong>{m.user_id === ticket.user_id ? 'Customer' : 'Support'}</strong>
            <p>{m.body}</p>
            {m.attachment_path && <Attachment path={m.attachment_path} />}
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
        <input
          key={fileInputKey}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0] ?? null)}
        />
        <button type="submit" disabled={sending}>
          {sending ? 'Sending...' : 'Send reply'}
        </button>
      </form>

      {error && <p>Something went wrong oopsie: {error}</p>}
    </div>
  )
}

export default TicketDetail