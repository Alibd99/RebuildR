function App() {
  return (
    <main className="app-shell">
      <div className="phone-frame">
        <header className="topbar">
          <p className="brand">RebuildR</p>
          <div className="topbar-actions" aria-hidden="true">
            <span />
            <span />
          </div>
        </header>

        <div className="content-scroll">
          <section className="hero-panel">
            <div className="mode-toggle" aria-label="Läge">
              <button className="mode-button" type="button">
                Marknadsplats
              </button>
              <button className="mode-button mode-button-active" type="button">
                Byggläge
              </button>
            </div>

            <p className="eyebrow">Rosendal Etapp 2</p>
            <h1>Min byggarbetsplats</h1>
            <p className="lead">
              Självbetjäning för container, in- och utcheckning samt material
              för köp eller hyra på plats.
            </p>

            <article className="site-summary">
              <div className="site-summary-row">
                <span>Container A</span>
                <span>Öppen nu</span>
              </div>
              <strong>Nästa hämtning 15:30</strong>
              <p>12 artiklar redo, 4 väntar på kontroll</p>
            </article>
          </section>

          <section className="section">
            <div className="section-heading">
              <h2>Snabbåtgärder</h2>
            </div>
            <div className="action-grid">
              <article className="action-card action-card-primary">
                <div className="action-icon" />
                <h3>Lås upp</h3>
                <p>Öppna containern med behörighet eller QR.</p>
              </article>

              <article className="action-card">
                <div className="action-icon action-icon-scan" />
                <h3>Skanna / lämna in</h3>
                <p>Registrera material direkt vid containern.</p>
              </article>

              <article className="action-card">
                <div className="action-icon action-icon-box" />
                <h3>Containerinnehåll</h3>
                <p>Se allt som finns tillgängligt på platsen just nu.</p>
              </article>

              <article className="action-card">
                <div className="action-icon action-icon-log" />
                <h3>Händelselogg</h3>
                <p>Öppna senaste in- och utcheckningar.</p>
              </article>
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <h2>I containern</h2>
            </div>
            <div className="filter-row">
              <button className="filter-pill filter-pill-active" type="button">
                Alla
              </button>
              <button className="filter-pill" type="button">
                Att köpa
              </button>
              <button className="filter-pill" type="button">
                Att hyra
              </button>
            </div>

            <div className="item-list">
              <article className="item-card">
                <div className="item-card-top">
                  <div className="item-image item-image-a" />
                  <span className="item-tag">Köp</span>
                </div>
                <h3>Innerdörrar</h3>
                <p>12 st • Gott skick</p>
                <strong>900 kr / st</strong>
              </article>

              <article className="item-card">
                <div className="item-card-top">
                  <div className="item-image item-image-b" />
                  <span className="item-tag item-tag-rental">Hyra</span>
                </div>
                <h3>Skyddsräcken</h3>
                <p>8 st • Returneras till container</p>
                <strong>45 kr / dag</strong>
              </article>

              <article className="item-card item-card-wide">
                <div className="item-card-header">
                  <div>
                    <span className="mini-label">Väntar på kontroll</span>
                    <h3>Elcentraler</h3>
                  </div>
                  <span className="status-pill status-pill-soft">4 st</span>
                </div>
                <p>
                  Saknar slutlig kontroll innan publicering i byggläge eller
                  marknadsplats.
                </p>
              </article>
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <h2>Idag</h2>
            </div>
            <div className="todo-list">
              <article className="todo-row">
                <span className="todo-dot" />
                <p>Kontrollera retur av skyddsräcken före 16:00</p>
              </article>
              <article className="todo-row">
                <span className="todo-dot" />
                <p>Skanna in nytt parti plywood från zon B</p>
              </article>
              <article className="todo-row">
                <span className="todo-dot" />
                <p>Godkänn två artiklar för publicering</p>
              </article>
            </div>
          </section>
        </div>

        <nav className="bottom-nav" aria-label="Primär navigation">
          <button className="nav-item nav-item-active" type="button">
            Hem
          </button>
          <button className="nav-item" type="button">
            Container
          </button>
          <button className="nav-item nav-item-center" type="button">
            Skanna
          </button>
          <button className="nav-item" type="button">
            Hitta
          </button>
          <button className="nav-item" type="button">
            Inkorg
          </button>
        </nav>
      </div>
    </main>
  );
}
export default App;
