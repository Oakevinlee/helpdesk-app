import { useState } from 'react'
import { supabase } from './supabaseClient'

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleLogIn(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    setBusy(false)
  }

  async function handleSignUp() {
    setBusy(true)
    setMessage('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) setMessage(error.message)
    else if (!data.session) setMessage('Check your email to confirm your account, homie.')
    setBusy(false)
  }

  return (
    <div>
      <h1>Helpdesk</h1>
      <form onSubmit={handleLogIn}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password (6+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={busy}>Log in</button>
        <button type="button" onClick={handleSignUp} disabled={busy}>Sign up</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  )
}

export default Auth