function App() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">RebuildR</p>
        <h1>Materialbank för byggåterbruk</h1>
        <p className="lead">
          En första version av webbappen med fokus på materialbanker på
          byggarbetsplatser, återbruk, uthyrning och spårbarhet.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Bakgrund</h2>
          <p>
            Arbetet handlar om hur återbruk kan fungera direkt på aktiva
            byggarbetsplatser, där material registreras, bedöms och hanteras
            vidare i olika flöden.
          </p>
        </article>

        <article className="card">
          <h2>Utgångspunkt</h2>
          <p>
            Det finns redan en app med sök, kategorier, annonser och inkorg.
            Den här delen fokuserar på ett separat flöde för byggplatser och
            materialbanker.
          </p>
        </article>

        <article className="card">
          <h2>Första delar</h2>
          <ul>
            <li>Platsöversikt</li>
            <li>Materialbatcher</li>
            <li>Batchdetalj</li>
            <li>Spårbarhetslogg</li>
          </ul>
        </article>

        <article className="card">
          <h2>Att arbeta vidare med</h2>
          <ul>
            <li>Vilken information behövs för varje batch?</li>
            <li>Vem ansvarar för registreringen på plats?</li>
            <li>När ska material säljas eller hyras ut?</li>
          </ul>
        </article>

        <article className="card card-wide">
          <h2>Start</h2>
          <p>
            Här byggs grunden för vidare arbete med sidor, komponenter och
            flöden kopplade till materialbanker och byggplatser.
          </p>
        </article>
      </section>
    </main>
  );
}
export default App;
