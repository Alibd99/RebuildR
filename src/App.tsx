import { useState } from "react";

type Screen = "home" | "container";
type Filter = "all" | "buy" | "rent";

const containerItems = [
  {
    id: 1,
    name: "Innerdörrar",
    details: "12 st • Gott skick",
    price: "900 kr / st",
    type: "buy" as const,
    status: "Redo",
    imageClass: "item-image-a",
  },
  {
    id: 2,
    name: "Skyddsräcken",
    details: "8 st • Returneras till container",
    price: "45 kr / dag",
    type: "rent" as const,
    status: "Uthyrbar",
    imageClass: "item-image-b",
  },
  {
    id: 3,
    name: "Plywoodskivor",
    details: "26 st • Zon B",
    price: "250 kr / st",
    type: "buy" as const,
    status: "Reserverad",
    imageClass: "item-image-c",
  },
  {
    id: 4,
    name: "Elcentraler",
    details: "4 st • Kräver kontroll",
    price: "Väntar på kontroll",
    type: "rent" as const,
    status: "Kontroll",
    imageClass: "item-image-d",
  },
];

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [filter, setFilter] = useState<Filter>("all");

  const filteredItems = containerItems.filter((item) => {
    if (filter === "all") return true;
    return item.type === filter;
  });

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
          {screen === "home" ? (
            <>
              <section className="hero-panel">
                <div className="mode-toggle" aria-label="Läge">
                  <button className="mode-button" type="button">
                    Marknadsplats
                  </button>
                  <button
                    className="mode-button mode-button-active"
                    type="button"
                  >
                    Byggläge
                  </button>
                </div>

                <p className="eyebrow">Rosendal Etapp 2</p>
                <h1>Min byggarbetsplats</h1>
                <p className="lead">
                  Självbetjäning för container, in- och utcheckning samt
                  material för köp eller hyra på plats.
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
                  <button
                    className="action-card action-card-button action-card-primary"
                    type="button"
                  >
                    <div className="action-icon" />
                    <h3>Lås upp</h3>
                    <p>Öppna containern med behörighet eller QR.</p>
                  </button>

                  <button className="action-card action-card-button" type="button">
                    <div className="action-icon action-icon-scan" />
                    <h3>Skanna / lämna in</h3>
                    <p>Registrera material direkt vid containern.</p>
                  </button>

                  <button
                    className="action-card action-card-button"
                    type="button"
                    onClick={() => setScreen("container")}
                  >
                    <div className="action-icon action-icon-box" />
                    <h3>Containerinnehåll</h3>
                    <p>Se allt som finns tillgängligt på platsen just nu.</p>
                  </button>

                  <button className="action-card action-card-button" type="button">
                    <div className="action-icon action-icon-log" />
                    <h3>Händelselogg</h3>
                    <p>Öppna senaste in- och utcheckningar.</p>
                  </button>
                </div>
              </section>

              <section className="section">
                <div className="section-heading">
                  <h2>I containern</h2>
                  <button
                    className="text-link"
                    type="button"
                    onClick={() => setScreen("container")}
                  >
                    Visa alla
                  </button>
                </div>

                <div className="item-list">
                  {containerItems.slice(0, 2).map((item) => (
                    <article className="item-card" key={item.id}>
                      <div className="item-card-top">
                        <div className={`item-image ${item.imageClass}`} />
                        <span
                          className={
                            item.type === "rent"
                              ? "item-tag item-tag-rental"
                              : "item-tag"
                          }
                        >
                          {item.type === "rent" ? "Hyra" : "Köp"}
                        </span>
                      </div>
                      <h3>{item.name}</h3>
                      <p>{item.details}</p>
                      <strong>{item.price}</strong>
                    </article>
                  ))}

                  <button
                    className="item-card item-card-wide item-card-button"
                    type="button"
                    onClick={() => setScreen("container")}
                  >
                    <div className="item-card-header">
                      <div>
                        <span className="mini-label">Container A</span>
                        <h3>Öppna containerinnehåll</h3>
                      </div>
                      <span className="status-pill">12 artiklar</span>
                    </div>
                    <p>Se köp, hyra och det som väntar på kontroll.</p>
                  </button>
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
            </>
          ) : (
            <>
              <section className="hero-panel hero-panel-compact">
                <button
                  className="back-link"
                  type="button"
                  onClick={() => setScreen("home")}
                >
                  ← Tillbaka
                </button>
                <p className="eyebrow">Rosendal Etapp 2</p>
                <h1>Containerinnehåll</h1>
                <p className="lead">
                  Container A • Det som finns tillgängligt på plats just nu.
                </p>
              </section>

              <section className="section">
                <div className="container-summary-grid">
                  <article className="summary-card">
                    <span className="summary-label">Tillgängligt</span>
                    <strong>12</strong>
                  </article>
                  <article className="summary-card">
                    <span className="summary-label">Att hyra</span>
                    <strong>4</strong>
                  </article>
                  <article className="summary-card">
                    <span className="summary-label">Att köpa</span>
                    <strong>8</strong>
                  </article>
                </div>
              </section>

              <section className="section">
                <div className="section-heading">
                  <h2>Filtrera</h2>
                </div>
                <div className="filter-row">
                  <button
                    className={
                      filter === "all"
                        ? "filter-pill filter-pill-active"
                        : "filter-pill"
                    }
                    type="button"
                    onClick={() => setFilter("all")}
                  >
                    Alla
                  </button>
                  <button
                    className={
                      filter === "buy"
                        ? "filter-pill filter-pill-active"
                        : "filter-pill"
                    }
                    type="button"
                    onClick={() => setFilter("buy")}
                  >
                    Att köpa
                  </button>
                  <button
                    className={
                      filter === "rent"
                        ? "filter-pill filter-pill-active"
                        : "filter-pill"
                    }
                    type="button"
                    onClick={() => setFilter("rent")}
                  >
                    Att hyra
                  </button>
                </div>
              </section>

              <section className="section section-tight">
                <div className="container-list">
                  {filteredItems.map((item) => (
                    <article className="container-row" key={item.id}>
                      <div className={`item-image ${item.imageClass}`} />
                      <div className="container-row-content">
                        <div className="container-row-top">
                          <h3>{item.name}</h3>
                          <span
                            className={
                              item.type === "rent"
                                ? "item-tag item-tag-rental"
                                : "item-tag"
                            }
                          >
                            {item.type === "rent" ? "Hyra" : "Köp"}
                          </span>
                        </div>
                        <p>{item.details}</p>
                        <div className="container-row-bottom">
                          <strong>{item.price}</strong>
                          <span
                            className={
                              item.status === "Kontroll"
                                ? "status-pill status-pill-soft"
                                : "status-pill"
                            }
                          >
                            {item.status}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <nav className="bottom-nav" aria-label="Primär navigation">
          <button
            className={screen === "home" ? "nav-item nav-item-active" : "nav-item"}
            type="button"
            onClick={() => setScreen("home")}
          >
            Hem
          </button>
          <button
            className={
              screen === "container" ? "nav-item nav-item-active" : "nav-item"
            }
            type="button"
            onClick={() => setScreen("container")}
          >
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
