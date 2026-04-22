import { useEffect, useState } from 'react'
import './App.css'

type CrossRef = {
  reference: string
  summary: string
  text_kjv?: string
  text_parallel?: string
}

type DailyEntry = {
  entry_id: string
  slug: string
  date_metadata: {
    hebrew_date_display: string
    gregorian_date_display: string
  }
  reading_metadata: {
    sefer: string
    parashah: string
    aliyah_label: string
    primary_reference: string
    focus_reference: string
  }
  content_payload: {
    content_theme: string
    scripture_snippet: string
    commentary_foundation: string
    commentary_crossrefs: CrossRef[]
    commentary_application: string
    practical_title: string
    practical_action: string
    reflection_prompt: string
    closing_charge: string
  }
  media_payload: {
    infographic_title?: string
    infographic_image?: string
    infographic_alt?: string
    infographic_caption?: string
  }
}

function App() {
  const [entry, setEntry] = useState<DailyEntry | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetch('/content/daily/current.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load daily entry')
        return res.json()
      })
      .then((data) => setEntry(data))
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return <main className="shell"><p>{error}</p></main>
  }

  if (!entry) {
    return <main className="shell"><p>Loading today’s reading...</p></main>
  }

  return (
    <main className="shell">
     <section className="hero">
  <p className="eyebrow">The Way: Disciple&apos;s Daily</p>
  <h1>{entry.content_payload.content_theme}</h1>
  <p className="page-subtitle">
    {entry.date_metadata.hebrew_date_display} · {entry.date_metadata.gregorian_date_display}
  </p>
  <p className="meta">
    {entry.reading_metadata.parashah} · {entry.reading_metadata.aliyah_label} · {entry.reading_metadata.primary_reference}
  </p>
</section>

      <section className="card">
        <h2>Scripture</h2>
        <blockquote>{entry.content_payload.scripture_snippet}</blockquote>
      </section>

      <section className="card">
        <h2>Commentary</h2>
        <p>{entry.content_payload.commentary_foundation}</p>
        <p>{entry.content_payload.commentary_application}</p>
      </section>

      <section className="card">
        <h2>Scripture interprets Scripture</h2>
        <div className="refs">
          {entry.content_payload.commentary_crossrefs.map((item) => (
            <article key={item.reference} className="ref">
              <h3>{item.reference}</h3>
              {item.text_kjv && <blockquote>{item.text_kjv}</blockquote>}
              <p>{item.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>{entry.content_payload.practical_title}</h2>
        <p>{entry.content_payload.practical_action}</p>
        <p><strong>Reflection:</strong> {entry.content_payload.reflection_prompt}</p>
        <p className="charge">{entry.content_payload.closing_charge}</p>
      </section>

      {entry.media_payload.infographic_image && (
        <section className="card">
          <h2>{entry.media_payload.infographic_title || 'Daily infographic'}</h2>
          <img
            className="infographic"
            src={`/${entry.media_payload.infographic_image}`}
            alt={entry.media_payload.infographic_alt || 'Daily infographic'}
          />
          {entry.media_payload.infographic_caption && (
            <p className="caption">{entry.media_payload.infographic_caption}</p>
          )}
        </section>
      )}
    </main>
  )
}

export default App
