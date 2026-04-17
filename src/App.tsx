import { useMemo, useState } from "react";
import QrScanner from "./components/QrScanner";

type Screen = "home" | "container" | "detail" | "scan" | "confirm" | "complete";
type Filter = "all" | "buy" | "rent";
type ScanMode = "lookup" | "verify";
type BrowseScreen = "home" | "container";
type ScanReturnScreen = BrowseScreen | "detail";

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
    details: "26 st",
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

const normalizeCode = (value: string) => value.trim().toLowerCase();

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<Material[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scanMode, setScanMode] = useState<ScanMode>("lookup");
  const [detailReturnScreen, setDetailReturnScreen] =
    useState<BrowseScreen>("home");
  const [scanReturnScreen, setScanReturnScreen] =
    useState<ScanReturnScreen>("home");

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (filter === "all") return true;
        return item.type === filter;
      }),
    [items, filter]
  );

  const userItems = useMemo(
    () => items.filter((item) => item.assignedUser === currentUser),
    [items]
  );

  const readyForPickup = useMemo(
    () =>
      userItems.filter(
        (item) => item.status === "Redo" || item.status === "Uthyrbar"
      ),
    [userItems]
  );

  const ownReadyCount = readyForPickup.length;

  const resetScanState = () => {
    setScanInput("");
    setVerifyMessage("");
    setScannerEnabled(true);
  };

  const lookupItemByCode = (code: string) =>
    items.find(
      (item) => normalizeCode(item.scanCode) === normalizeCode(code)
    ) ?? null;

  const openDetail = (itemId: string, returnScreen: BrowseScreen) => {
    setSelectedId(itemId);
    setDetailReturnScreen(returnScreen);
    resetScanState();
    setScreen("detail");
  };

  const openLookupScan = (returnScreen: BrowseScreen) => {
    setSelectedId(null);
    setScanMode("lookup");
    setScanReturnScreen(returnScreen);
    resetScanState();
    setScreen("scan");
  };

  const openVerifyScan = (itemId: string) => {
    setSelectedId(itemId);
    setScanMode("verify");
    setScanReturnScreen("detail");
    resetScanState();
    setScreen("scan");
  };

  const verifyPickup = (
    codeValue: string = scanInput,
    itemOverride?: Material | null
  ) => {
    const targetItem = itemOverride ?? selectedItem ?? lookupItemByCode(codeValue);

    if (!targetItem) {
      setVerifyMessage("⚠️ Ingen artikel matchade QR-koden.");
      return false;
    }

    setSelectedId(targetItem.id);

    if (targetItem.assignedUser !== currentUser) {
      setVerifyMessage("❌ Fel användare – materialet är inte tilldelat dig.");
      return false;
    }

    if (targetItem.status === "Kontroll") {
      setVerifyMessage("⚠️ Materialet väntar fortfarande på kontroll.");
      return false;
    }

    if (targetItem.status === "Hämtad") {
      setVerifyMessage("ℹ️ Materialet är redan markerat som hämtat.");
      return false;
    }

    if (
      normalizeCode(codeValue) !== normalizeCode(targetItem.scanCode)
    ) {
      setVerifyMessage(
        "⚠️ Fel materialkod – kontrollera att du har rätt artikel."
      );
      return false;
    }

    setVerifyMessage("");
    setScreen("confirm");
    return true;
  };

  const handleScanResult = (text: string) => {
    setScanInput(text);
    setVerifyMessage("");
    setScannerEnabled(false);

    if (scanMode === "lookup") {
      const foundItem = lookupItemByCode(text);

      if (!foundItem) {
        setVerifyMessage("⚠️ Ingen artikel matchade QR-koden.");
        return;
      }

      setSelectedId(foundItem.id);
      setDetailReturnScreen(
        scanReturnScreen === "container" ? "container" : "home"
      );
      setScreen("detail");
      return;
    }

    verifyPickup(text);
  };

  const handleScannerError = (message: string) => {
    setVerifyMessage(`⚠️ ${message}`);
    setScannerEnabled(false);
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

  const currentScanBackScreen =
    scanReturnScreen === "detail" ? "detail" : scanReturnScreen;

  const currentDetailMessage = (() => {
    if (!selectedItem) return "";

    if (selectedItem.status === "Hämtad") {
      return "Artikeln är redan markerad som hämtad.";
    }

    if (selectedItem.status === "Kontroll") {
      return "Artikeln väntar fortfarande på kontroll innan den kan lämnas ut.";
    }

    if (selectedItem.assignedUser !== currentUser) {
      return `Artikeln är tilldelad ${selectedItem.assignedUser}.`;
    }

    return "Artikeln kan verifieras med QR-kod vid upphämtning.";
  })();

  const detailActionEnabled =
    selectedItem?.assignedUser === currentUser &&
    selectedItem?.status !== "Hämtad" &&
    selectedItem?.status !== "Kontroll";

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
                  <p>{ownReadyCount} artiklar redo för upphämtning</p>
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
                    onClick={() => openLookupScan("home")}
                  >
                    <div className="action-icon action-icon-scan" />
                    <h3>Skanna / verifiera</h3>
                    <p>Skanna en QR-kod och öppna rätt artikel direkt.</p>
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

                {readyForPickup.length > 0 ? (
                  <div className="item-list">
                    {readyForPickup.map((item) => (
                      <article className="item-card" key={item.id}>
                        <div className="item-card-top">
                          <div className={`item-image ${item.imageClass}`} />
                          <span className="item-tag">Redo</span>
                        </div>

                        <h3>{item.name}</h3>
                        <p>{item.details}</p>
                        <strong>{item.location}</strong>

                        <div className="inline-actions">
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => openDetail(item.id, "home")}
                          >
                            Visa detalj
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <article className="card">
                    <h3>Inget redo just nu</h3>
                    <p>Det finns inga artiklar som väntar på upphämtning.</p>
                  </article>
                )}
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

                      <div className="inline-actions">
                        <button
                          className="text-link"
                          type="button"
                          onClick={() => openDetail(item.id, "home")}
                        >
                          Visa detalj
                        </button>
                      </div>
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

                        <div className="inline-actions">
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => openDetail(item.id, "container")}
                          >
                            Visa detalj
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}

          {screen === "detail" && selectedItem && (
            <>
              <section className="hero-panel hero-panel-compact">
                <button
                  className="back-link"
                  type="button"
                  onClick={() => setScreen(detailReturnScreen)}
                >
                  ← Tillbaka
                </button>
                <p className="eyebrow">{selectedItem.location}</p>
                <h1>{selectedItem.name}</h1>
                <p className="lead">{selectedItem.description}</p>
              </section>

              <section className="section">
                <article className="card">
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span>Status</span>
                      <strong>{selectedItem.status}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Typ</span>
                      <strong>{selectedItem.type === "rent" ? "Hyra" : "Köp"}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Pris</span>
                      <strong>{selectedItem.price}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Tilldelad</span>
                      <strong>
                        {selectedItem.assignedUser === currentUser
                          ? "Du"
                          : selectedItem.assignedUser}
                      </strong>
                    </div>
                    <div className="detail-row">
                      <span>QR-kod</span>
                      <strong>{selectedItem.scanCode}</strong>
                    </div>
                  </div>

                  <div className="message-box message-box-soft">
                    {currentDetailMessage}
                  </div>

                  <div className="item-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => openVerifyScan(selectedItem.id)}
                      disabled={!detailActionEnabled}
                    >
                      Skanna och verifiera
                    </button>

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setScreen(detailReturnScreen)}
                    >
                      Tillbaka
                    </button>
                  </div>
                </article>
              </section>
            </>
          )}

          {screen === "scan" && (
            <>
              <section className="hero-panel hero-panel-compact">
                <button
                  className="back-link"
                  type="button"
                  onClick={() => setScreen(currentScanBackScreen)}
                >
                  ← Tillbaka
                </button>
                <p className="eyebrow">
                  {scanMode === "lookup" ? "Skanna" : "Verifiering"}
                </p>
                <h1>
                  {scanMode === "lookup"
                    ? "Skanna QR-kod"
                    : "Verifiera upphämtning"}
                </h1>
                <p className="lead">
                  {scanMode === "lookup"
                    ? "Skanna en QR-kod för att öppna rätt artikel direkt."
                    : "Skanna QR-koden på artikeln för att kontrollera upphämtningen."}
                </p>
              </section>

              <section className="section">
                <article className="card">
                  {scanMode === "verify" && selectedItem ? (
                    <div className="scan-target">
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
                        Testkod: <strong>{selectedItem.scanCode}</strong>
                      </p>
                    </div>
                  ) : (
                    <div className="scan-target">
                      <h3>Skanna en artikel</h3>
                      <p>
                        Testa till exempel QR-koden för <strong>door-12</strong> för
                        att öppna artikeln direkt.
                      </p>
                    </div>
                  )}

                  <div className="scanner-block">
                    {scannerEnabled && (
                      <QrScanner
                        onScan={handleScanResult}
                        onError={handleScannerError}
                      />
                    )}

                    <input
                      className="form-input"
                      value={scanInput}
                      onChange={(event) => setScanInput(event.target.value)}
                      placeholder="Skriv eller skanna material-ID"
                    />
                  </div>

                  <div className="item-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={resetScanState}
                    >
                      Rensa och skanna igen
                    </button>

                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        if (scanMode === "lookup") {
                          const foundItem = lookupItemByCode(scanInput);

                          if (!foundItem) {
                            setVerifyMessage("⚠️ Ingen artikel matchade QR-koden.");
                            return;
                          }

                          setSelectedId(foundItem.id);
                          setDetailReturnScreen(
                            scanReturnScreen === "container"
                              ? "container"
                              : "home"
                          );
                          setScreen("detail");
                          return;
                        }

                        verifyPickup();
                      }}
                    >
                      {scanMode === "lookup" ? "Öppna artikel" : "Verifiera"}
                    </button>
                  </div>

                  {verifyMessage && (
                    <div className="message-box">
                      <p>{verifyMessage}</p>
                    </div>
                  )}
                </article>
              </section>
            </>
          )}

          {screen === "confirm" && selectedItem && (
            <>
              <section className="hero-panel hero-panel-compact">
                <button
                  className="back-link"
                  type="button"
                  onClick={() => setScreen("detail")}
                >
                  ← Tillbaka
                </button>
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

                  <div className="item-actions">
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
                      onClick={() => setScreen("detail")}
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

                  <div className="item-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        resetScanState();
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
              screen === "container" ||
              (screen === "detail" && detailReturnScreen === "container")
                ? "nav-item nav-item-active"
                : "nav-item"
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
            onClick={() =>
              openLookupScan(
                screen === "container" ||
                  (screen === "detail" && detailReturnScreen === "container")
                  ? "container"
                  : "home"
              )
            }
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
