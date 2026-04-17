import { useMemo, useState } from "react";

type Screen = "home" | "container" | "scan" | "confirm" | "complete";
type Filter = "all" | "buy" | "rent";

type Material = {
  id: string;
  name: string;
  details: string;
  description: string;
  location: string;
  price: string;
  type: "buy" | "rent";
  status: "Redo" | "Uthyrbar" | "Hämtad" | "Kontroll";
  imageClass: string;
  assignedUser: string;
  scanCode: string;
};

const currentUser = "Ali";

const initialItems: Material[] = [
  {
    id: "door-12",
    name: "Innerdörrar",
    details: "12 st • Gott skick",
    description: "Begagnade innerdörrar i gott skick.",
    location: "Container A",
    price: "900 kr / st",
    type: "buy",
    status: "Redo",
    imageClass: "item-image-a",
    assignedUser: "Ali",
    scanCode: "door-12",
  },
  {
    id: "rail-8",
    name: "Skyddsräcken",
    details: "8 st • Returneras till container",
    description: "Skyddsräcken för tillfällig användning.",
    location: "Container A",
    price: "45 kr / dag",
    type: "rent",
    status: "Uthyrbar",
    imageClass: "item-image-b",
    assignedUser: "Axel",
    scanCode: "rail-8",
  },
  {
    id: "ply-26",
    name: "Plywoodskivor",
    details: "26 st • Zon B",
    description: "Plywoodskivor redo för upphämtning.",
    location: "Zon B",
    price: "250 kr / st",
    type: "buy",
    status: "Redo",
    imageClass: "item-image-c",
    assignedUser: "Ali",
    scanCode: "ply-26",
  },
  {
    id: "el-4",
    name: "Elcentraler",
    details: "4 st • Kräver kontroll",
    description: "Elcentraler som väntar på kontroll.",
    location: "Container A",
    price: "Väntar på kontroll",
    type: "rent",
    status: "Kontroll",
    imageClass: "item-image-d",
    assignedUser: "Ali",
    scanCode: "el-4",
  },
];

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<Material[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    return item.type === filter;
  });

  const readyForPickup = items.filter((item) => item.status === "Redo");

  const openScan = (itemId: string) => {
    setSelectedId(itemId);
    setScanInput("");
    setVerifyMessage("");
    setScreen("scan");
  };

  const verifyPickup = () => {
    if (!selectedItem) return;

    if (selectedItem.assignedUser !== currentUser) {
      setVerifyMessage("❌ Fel användare – materialet är inte tilldelat dig.");
      return;
    }

    if (selectedItem.status === "Kontroll") {
      setVerifyMessage("⚠️ Materialet väntar fortfarande på kontroll.");
      return;
    }

    if (selectedItem.status === "Hämtad") {
      setVerifyMessage("ℹ️ Materialet är redan markerat som hämtat.");
      return;
    }

    if (scanInput.trim().toLowerCase() !== selectedItem.scanCode.toLowerCase()) {
      setVerifyMessage("⚠️ Fel materialkod – kontrollera att du har rätt artikel.");
      return;
    }

    setVerifyMessage("✅ Verifiering lyckades.");
    setScreen("confirm");
  };

  const confirmPickup = () => {
    if (!selectedItem) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedItem.id ? { ...item, status: "Hämtad" } : item
      )
    );

    setScreen("complete");
  };

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
          {screen === "home" && (
            <>
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
                  Självbetjäning för container, verifiering av upphämtning och
                  material kopplat till rätt användare.
                </p>

                <article className="site-summary">
                  <div className="site-summary-row">
                    <span>Container A</span>
                    <span>Öppen nu</span>
                  </div>
                  <strong>Inloggad: {currentUser}</strong>
                  <p>
                    {
                      items.filter(
                        (item) =>
                          item.status === "Redo" && item.assignedUser === currentUser
                      ).length
                    }{" "}
                    artiklar redo för upphämtning
                  </p>
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
                    onClick={() => setScreen("container")}
                  >
                    <div className="action-icon" />
                    <h3>Mina material</h3>
                    <p>Se vilka artiklar som är kopplade till dig.</p>
                  </button>

                  <button
                    className="action-card action-card-button"
                    type="button"
                    onClick={() => {
                      const firstOwnReadyItem =
                        items.find(
                          (item) =>
                            item.assignedUser === currentUser &&
                            item.status !== "Hämtad"
                        ) ?? null;

                      if (firstOwnReadyItem) {
                        openScan(firstOwnReadyItem.id);
                      }
                    }}
                  >
                    <div className="action-icon action-icon-scan" />
                    <h3>Skanna / verifiera</h3>
                    <p>Verifiera att rätt person hämtar rätt material.</p>
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
                  <h2>Redo för upphämtning</h2>
                </div>

                <div className="item-list">
                  {readyForPickup.map((item) => (
                    <article className="item-card" key={item.id}>
                      <div className="item-card-top">
                        <div className={`item-image ${item.imageClass}`} />
                        <span className="item-tag">Redo</span>
                      </div>

                      <h3>{item.name}</h3>
                      <p>{item.details}</p>

                      <strong>
                        {item.assignedUser === currentUser
                          ? "Tilldelad dig"
                          : `Tilldelad ${item.assignedUser}`}
                      </strong>

                      <div style={{ marginTop: "10px" }}>
                        <button
                          className="text-link"
                          type="button"
                          onClick={() => openScan(item.id)}
                        >
                          Verifiera
                        </button>
                      </div>
                    </article>
                  ))}
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
                  {items.slice(0, 2).map((item) => (
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
                </div>
              </section>
            </>
          )}

          {screen === "container" && (
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

                        <div style={{ marginTop: "10px" }}>
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => openScan(item.id)}
                          >
                            Verifiera
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}

          {screen === "scan" && (
            <>
              <section className="hero-panel hero-panel-compact">
                <button
                  className="back-link"
                  type="button"
                  onClick={() => setScreen("home")}
                >
                  ← Tillbaka
                </button>
                <p className="eyebrow">Verifiering</p>
                <h1>Skanna material</h1>
                <p className="lead">
                  Kontrollera att rätt person hämtar rätt material.
                </p>
              </section>

              <section className="section">
                <article className="card">
                  {selectedItem ? (
                    <>
                      <h3>{selectedItem.name}</h3>
                      <p>{selectedItem.details}</p>
                      <p>Plats: {selectedItem.location}</p>
                      <p>
                        Tilldelad:{" "}
                        {selectedItem.assignedUser === currentUser
                          ? "Du"
                          : selectedItem.assignedUser}
                      </p>
                      <p>
                        Demo-kod: <strong>{selectedItem.scanCode}</strong>
                      </p>

                      <div style={{ marginTop: "16px" }}>
                        <input
                          value={scanInput}
                          onChange={(e) => setScanInput(e.target.value)}
                          placeholder="Skriv eller skanna material-ID"
                          style={{
                            width: "100%",
                            minHeight: "44px",
                            padding: "0 12px",
                            borderRadius: "12px",
                            border: "1px solid #dce6dc",
                            marginBottom: "12px",
                          }}
                        />

                        <button
                          className="action-card action-card-button action-card-primary"
                          type="button"
                          onClick={verifyPickup}
                        >
                          <div className="action-icon action-icon-scan" />
                          <h3>Verifiera</h3>
                          <p>Kontrollera användare och artikel-ID.</p>
                        </button>

                        {verifyMessage && (
                          <p style={{ marginTop: "12px", fontWeight: 600 }}>
                            {verifyMessage}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p>Välj först en artikel från listan.</p>
                  )}
                </article>
              </section>
            </>
          )}

          {screen === "confirm" && selectedItem && (
            <>
              <section className="hero-panel hero-panel-compact">
                <p className="eyebrow">Bekräfta</p>
                <h1>Bekräfta upphämtning</h1>
                <p className="lead">
                  Kontrollera en sista gång innan upphämtningen registreras.
                </p>
              </section>

              <section className="section">
                <article className="card card-highlight">
                  <h3>{selectedItem.name}</h3>
                  <p>{selectedItem.details}</p>
                  <p>Plats: {selectedItem.location}</p>
                  <p>Tilldelad: {selectedItem.assignedUser}</p>

                  <div className="item-actions" style={{ marginTop: "16px" }}>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={confirmPickup}
                    >
                      Bekräfta upphämtning
                    </button>

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setScreen("scan")}
                    >
                      Avbryt
                    </button>
                  </div>
                </article>
              </section>
            </>
          )}

          {screen === "complete" && selectedItem && (
            <>
              <section className="hero-panel hero-panel-compact">
                <p className="eyebrow">Klart</p>
                <h1>Upphämtning genomförd</h1>
                <p className="lead">
                  Materialet har markerats som upphämtat i systemet.
                </p>
              </section>

              <section className="section">
                <article className="card card-accent">
                  <h3>{selectedItem.name}</h3>
                  <p>Status har uppdaterats till Hämtad.</p>

                  <div className="item-actions" style={{ marginTop: "16px" }}>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        setSelectedId(null);
                        setScanInput("");
                        setVerifyMessage("");
                        setScreen("home");
                      }}
                    >
                      Tillbaka till Hem
                    </button>
                  </div>
                </article>
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

          <button
            className={
              screen === "scan"
                ? "nav-item nav-item-center nav-item-active"
                : "nav-item nav-item-center"
            }
            type="button"
            onClick={() => {
              const firstOwnReadyItem =
                items.find(
                  (item) =>
                    item.assignedUser === currentUser && item.status !== "Hämtad"
                ) ?? null;

              if (firstOwnReadyItem) {
                openScan(firstOwnReadyItem.id);
              }
            }}
          >
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