import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function Attachment({ path }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    supabase.storage
      .from('attachments')
      .createSignedUrl(path, 60 * 60) // link works for 1 hour
      .then(({ data }) => {
        if (data) setUrl(data.signedUrl)
      })
  }, [path])

  if (!url) return <p>Loading image...</p>
  return <img src={url} alt="Attachment" style={{ maxWidth: '300px' }} />
}

export default Attachment