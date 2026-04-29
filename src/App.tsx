import { useCallback, useEffect, useMemo, useState } from "react";
import QrScanner from "./components/QrScanner";
import IntMap from "./components/Map";
import { supabase } from "./lib/supabaseClient";

type Screen =
  | "home"
  | "container"
  | "detail"
  | "scan"
  | "confirm"
  | "complete"
  | "log"
  | "find"
  | "inbox";
type Filter = "all" | "buy" | "rent";
type ScanMode = "lookup" | "verify";
type BrowseScreen = "home" | "container";
type ScanReturnScreen = BrowseScreen | "detail";
type EventStatus = "info" | "success" | "warning";
type MaterialStatus = "Redo" | "Uthyrbar" | "Hämtad" | "Kontroll";

type Material = {
  id: string;
  name: string;
  details: string;
  description: string;
  container: string;
  price: string;
  type: "buy" | "rent";
  status: MaterialStatus;
  imageClass: string;
  assignedUser: string;
  scanCode: string;
};

type EventLogItem = {
  id: string;
  time: string;
  title: string;
  description: string;
  status: EventStatus;
  materialName?: string;
};

const currentUser = "Ali";

const normalizeCode = (value: string) => value.trim().toLowerCase();

const createTimeLabel = () =>
  new Date().toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });

type Container = {
  id: number;
  name: string;
  mode: "pickup" | "transport";
  accessCode: string;
};

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<Material[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scanMode, setScanMode] = useState<ScanMode>("lookup");
  const [eventLog, setEventLog] = useState<EventLogItem[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [materialError, setMaterialError] = useState("");
  const [isSavingPickup, setIsSavingPickup] = useState(false);
  const [pickupError, setPickupError] = useState("");
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [unlockCode, setUnlockCode] = useState("");
  const [unlockCodeError, setUnlockCodeError] = useState("");
  const [hasScanned, setHasScanned] = useState(false);
  const [inboxMode, setInboxMode] = useState<"seller" | "buyer">("seller");
  const [detailReturnScreen, setDetailReturnScreen] =
    useState<BrowseScreen>("home");
  const [scanReturnScreen, setScanReturnScreen] =
    useState<ScanReturnScreen>("home");

  const [containers, setContainers] = useState<Container[]>([]);
  const [isLoadingContainers, setIsLoadingContainers] = useState(true);
  const [containerError, setContainerError] = useState("");
  const [selectedContainerId, setSelectedContainerId] = useState<number | null>(null);


  const [bluetoothStatus, setBluetoothStatus] = useState<
    "idle" | "connecting" | "connected" | "unlocked" | "denied"
  >("idle");

  const [bluetoothMessage, setBluetoothMessage] = useState("");

  const currentContainer = containers.find(
    (c) => c.id === selectedContainerId
  );

  const containerName = currentContainer?.name ?? "containerName";

  const normalizeUnlockCode = (value: string) =>
    value.trim().replace(/\s+/g, "");

    
    const fetchMaterials = useCallback(async () => {
      setIsLoadingMaterials(true);
      setMaterialError("");

    const { data, error } = await supabase.from("materials").select("*, containers(name)");

    if (error) {
      console.error("Error fetching materials: ", error);
      setMaterialError("Kunde inte hämta material från databasen.");
      setIsLoadingMaterials(false);
      return;
    }

    const mappedData: Material[] = data.map((col) => {
      const imagePath = col.image_class ?? "";
      const imageUrl = imagePath
        ? supabase.storage.from("images").getPublicUrl(imagePath).data.publicUrl
        : "";

      return {
        id: col.id,
        name: col.name,
        details: col.details ?? "",
        description: col.description ?? "",
        container: col.containers?.name ?? "",
        price: col.price ?? "",
        type: col.type ?? "buy",
        status: (col.status ?? "Kontroll") as MaterialStatus,
        imageClass: imageUrl,
        assignedUser: col.assigned_user ?? "",
        scanCode: col.scan_code ?? "",
      };
    });

    setItems(mappedData);
    setIsLoadingMaterials(false);
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const fetchContainers = useCallback(async () => {
    setIsLoadingContainers(true);
    setContainerError("");

    const { data, error } = await supabase
      .from("containers")
      .select("id, name, mode, access_code")
      .order("name");

    if (error) {
      console.error("Error fetching containers:", error);
      setContainerError("Kunde inte hämta containrar från databasen.");
      setIsLoadingContainers(false);
      return;
    }

    const mappedContainers: Container[] = (data ?? []).map((container) => ({
      id: container.id,
      name: container.name,
      mode: (container.mode ?? "pickup") as "pickup" | "transport",
      accessCode: String(container.access_code ?? ""),
    }));

    setContainers(mappedContainers);

    if ((data ?? []).length > 0) {
      setSelectedContainerId((current) => current ?? data![0].id);
    }

    setIsLoadingContainers(false);
  }, []);

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const selectedItemContainer = containers.find(
      (c) => c.name === selectedItem?.container
    );


  const filteredItems = useMemo(
  () =>
    items.filter((item) => {
      const matchesFilter = filter === "all" ? true : item.type === filter;
      const matchesContainer = item.container === containerName;
      return matchesFilter && matchesContainer;
      }),
    [items, filter, containerName]
  );

  const userItems = useMemo(
  () =>
    items.filter(
      (item) =>
        item.assignedUser === currentUser &&
        item.container === containerName
    ),
  [items, containerName]
  );

  const readyForPickup = useMemo(
    () =>
      userItems.filter(
        (item) => item.status === "Redo" || item.status === "Uthyrbar"
      ),
    [userItems]
  );

  const ownReadyCount = readyForPickup.length;

  const addEventLogItem = ({
    title,
    description,
    status = "info",
    materialName,
  }: {
    title: string;
    description: string;
    status?: EventStatus;
    materialName?: string;
  }) => {
    setEventLog((prev) => [
      {
        id: `${Date.now()}-${prev.length}`,
        time: createTimeLabel(),
        title,
        description,
        status,
        materialName,
      },
      ...prev,
    ]);
  };

  const resetScanState = () => {
    setScanInput("");
    setVerifyMessage("");
    setPickupError("");
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

    if (selectedItemContainer?.mode === "transport") {
      setVerifyMessage(
        "Denna container transporteras till hub – ingen upphämtning."
      );
      return false;
    }
    const targetItem = itemOverride ?? selectedItem ?? lookupItemByCode(codeValue);

    if (!targetItem) {
      setVerifyMessage("⚠️ Ingen artikel matchade QR-koden.");
      addEventLogItem({
        title: "Okänd QR-kod",
        description: `Koden ${codeValue || "saknas"} matchade ingen artikel.`,
        status: "warning",
      });
      return false;
    }

    setSelectedId(targetItem.id);

    if (targetItem.assignedUser !== currentUser) {
      setVerifyMessage("❌ Fel användare – materialet är inte tilldelat dig.");
      addEventLogItem({
        title: "Upphämtning nekad",
        description: `${targetItem.name} är tilldelad ${targetItem.assignedUser}.`,
        status: "warning",
        materialName: targetItem.name,
      });
      return false;
    }

    if (targetItem.status === "Kontroll") {
      setVerifyMessage("⚠️ Materialet väntar fortfarande på kontroll.");
      addEventLogItem({
        title: "Upphämtning stoppad",
        description: `${targetItem.name} väntar fortfarande på kontroll.`,
        status: "warning",
        materialName: targetItem.name,
      });
      return false;
    }

    if (targetItem.status === "Hämtad") {
      setVerifyMessage("ℹ️ Materialet är redan markerat som hämtat.");
      addEventLogItem({
        title: "Redan upphämtad",
        description: `${targetItem.name} är redan markerad som hämtad.`,
        status: "info",
        materialName: targetItem.name,
      });
      return false;
    }

    if (
      normalizeCode(codeValue) !== normalizeCode(targetItem.scanCode)
    ) {
      setVerifyMessage(
        "⚠️ Fel materialkod – kontrollera att du har rätt artikel."
      );
      addEventLogItem({
        title: "Fel QR-kod",
        description: `Koden matchade inte ${targetItem.name}.`,
        status: "warning",
        materialName: targetItem.name,
      });
      return false;
    }

    addEventLogItem({
      title: "Verifiering godkänd",
      description: `${targetItem.name} verifierades för ${currentUser}.`,
      status: "success",
      materialName: targetItem.name,
    });
    setVerifyMessage("");
    setScreen("confirm");
    return true;
  };

  const handleScanResult = (text: string) => {
    if (hasScanned) return;

    setHasScanned(false);
    setScannerEnabled(false);
    setScanInput(text);
    setVerifyMessage("");

    if (scanMode === "lookup") {
      const foundItem = lookupItemByCode(text);

      if (!foundItem) {
        setVerifyMessage("⚠️ Ingen artikel matchade QR-koden.");
        addEventLogItem({
          title: "Okänd QR-kod",
          description: `Koden ${text} matchade ingen artikel.`,
          status: "warning",
        });
        return;
      }

      addEventLogItem({
        title: "Artikel öppnad via QR",
        description: `${foundItem.name} öppnades från QR-skanning.`,
        status: "info",
        materialName: foundItem.name,
      });
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
    addEventLogItem({
      title: "Kamera kunde inte starta",
      description: message,
      status: "warning",
    });
    setScannerEnabled(false);
  };

  const confirmPickup = async () => {
    if (!selectedItem) return;

    setIsSavingPickup(true);
    setPickupError("");

    const nextStatus: MaterialStatus = "Hämtad";
    const { data: updatedMaterial, error } = await supabase
      .from("materials")
      .update({ status: nextStatus as never })
      .eq("id", selectedItem.id)
      .select("id, status")
      .maybeSingle();

    if (error || String(updatedMaterial?.status ?? "") !== nextStatus) {
      console.error("Error updating material status: ", error);
      setPickupError("Kunde inte spara upphämtningen i databasen.");
      addEventLogItem({
        title: "Upphämtning kunde inte sparas",
        description:
          error?.message ??
          `${selectedItem.name} uppdaterades inte i databasen.`,
        status: "warning",
        materialName: selectedItem.name,
      });
      setIsSavingPickup(false);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedItem.id ? { ...item, status: nextStatus } : item
      )
    );

    addEventLogItem({
      title: "Upphämtning registrerad",
      description: `${selectedItem.name} markerades som hämtad av ${currentUser}.`,
      status: "success",
      materialName: selectedItem.name,
    });
    setIsSavingPickup(false);
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
    bluetoothStatus === "unlocked" &&
    selectedItemContainer?.mode === "pickup" &&
    selectedItem?.assignedUser === currentUser &&
    selectedItem?.status !== "Hämtad" &&
    selectedItem?.status !== "Kontroll";

  const handleBluetoothAccess = () => {
    if (!currentContainer) return;

    setUnlockCodeError("");

    if (currentContainer.mode === "transport") {
      setBluetoothConnected(false);
      setIsConnecting(false);
      setBluetoothStatus("denied");
      setBluetoothMessage(
        "Åtkomst nekad. Denna container är markerad för transport till hub."
      );
      addEventLogItem({
        title: "Container låst",
        description: `${containerName} kan inte öppnas eftersom den är markerad för transport.`,
        status: "warning",
      });
      return;
    }

    const enteredCode = normalizeUnlockCode(unlockCode);
    const expectedCode = normalizeUnlockCode(currentContainer.accessCode);

    if (!enteredCode) {
      setBluetoothConnected(false);
      setIsConnecting(false);
      setBluetoothStatus("denied");
      setUnlockCodeError("Ange containerkoden innan du låser upp.");
      setBluetoothMessage("Åtkomst nekad. Ingen containerkod angiven.");
      addEventLogItem({
        title: "Containerkod saknas",
        description: `${containerName} kunde inte öppnas eftersom ingen kod angavs.`,
        status: "warning",
      });
      return;
    }

    if (enteredCode !== expectedCode) {
      setBluetoothConnected(false);
      setIsConnecting(false);
      setBluetoothStatus("denied");
      setUnlockCodeError("Fel kod. Kontrollera koden och försök igen.");
      setBluetoothMessage("Åtkomst nekad. Containerkoden stämde inte.");
      addEventLogItem({
        title: "Fel containerkod",
        description: `${containerName} nekade åtkomst efter en felaktig kod.`,
        status: "warning",
      });
      return;
    }

    setIsConnecting(true);
    setBluetoothStatus("connecting");
    setBluetoothMessage(`Kod verifierad. Ansluter till ${containerName} via Bluetooth...`);

    setTimeout(() => {
      setBluetoothConnected(true);
      setIsConnecting(false);
      setBluetoothStatus("connected");
      setBluetoothMessage(`Kod godkänd. Bluetooth ansluten till ${containerName}.`);

      setTimeout(() => {
        setBluetoothStatus("unlocked");
        setBluetoothMessage(
          ownReadyCount > 0
            ? `${containerName} är nu öppnad. ${ownReadyCount} artiklar är redo för upphämtning.`
            : `${containerName} är nu öppnad. Du har inga artiklar redo för upphämtning just nu.`
        );
        addEventLogItem({
          title: "Container öppnad",
          description:
            ownReadyCount > 0
              ? `${containerName} öppnades efter verifierad containerkod.`
              : `${containerName} öppnades efter verifierad containerkod, men inga artiklar är redo för upphämtning.`,
          status: "success",
        });
      }, 1000);
    }, 1200);
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
                    <span>{containerName}</span>
                    <span>Tillgänglig</span>
                  </div>

                  <strong>Inloggad: {currentUser}</strong>

                <div className= "badge-row">
                    <div
                    className={
                    currentContainer?.mode === "pickup"
                      ? "mode-badge mode-badge-pickup"
                      : "mode-badge mode-badge-transport"
                  }
                >
                  {currentContainer?.mode === "pickup"
                    ? "📦 Upphämtning"
                    : "🚚 Hubtransport"}
                </div>

                <div
                  className={
                    bluetoothStatus === "connected" || bluetoothStatus === "unlocked"
                      ? "bluetooth-badge bluetooth-connected"
                      : bluetoothStatus === "denied"
                      ? "bluetooth-badge bluetooth-denied"
                      : "bluetooth-badge bluetooth-disconnected"
                  }
                >
                  {bluetoothStatus === "connected" || bluetoothStatus === "unlocked"
                    ? "Bluetooth ansluten"
                    : bluetoothStatus === "denied"
                    ? "Åtkomst nekad"
                    : bluetoothStatus === "connecting"
                    ? "Ansluter..."
                    : "Ej ansluten"}
                </div>
              </div>

                  <p>
                    {currentContainer?.mode === "pickup"
                      ? ownReadyCount > 0
                        ? `${ownReadyCount} artiklar redo för upphämtning`
                        : "Inga artiklar redo för upphämtning just nu"
                      : "Containern väntar på transport till hub"}
                  </p>

                  {currentContainer?.mode === "transport" && (
                    <div className="message-box" style={{ marginTop: "12px" }}>
                      <p>Denna container är i transportläge och kan inte öppnas för individuell upphämtning.</p>
                    </div>
                  )}

                  <div className="unlock-panel">
                    <label className="unlock-label" htmlFor="container-unlock-code">
                      Containerkod
                    </label>
                    <input
                      id="container-unlock-code"
                      className={
                        unlockCodeError
                          ? "form-input unlock-input form-input-error"
                          : "form-input unlock-input"
                      }
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Ange kod"
                      value={unlockCode}
                      onChange={(event) => {
                        setUnlockCode(event.target.value);
                        if (unlockCodeError) {
                          setUnlockCodeError("");
                        }
                      }}
                    />
                    <p className="unlock-hint">
                      Ange koden för vald container innan upplåsning.
                    </p>
                    {unlockCodeError && (
                      <p className="unlock-error">{unlockCodeError}</p>
                    )}
                  </div>
                  <div className="item-action" style={{ marginTop: "12px" }}>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={handleBluetoothAccess}
                    disabled={isConnecting}
                  >
                    {isConnecting ? "Ansluter..." : "Verifiera kod och lås upp"}
                      </button> 

                  </div>

                    {bluetoothMessage && (
                      <div className="message-box" style={{ marginTop: "12px" }}>
                        <p> {bluetoothMessage} </p>
                      </div>
                      )}

                      <div className="message-box message-box-soft" style={{ marginTop: "12px" }}>
                        <p>QR används för att verifiera material. Bluetooth används för att öppna containern.</p>
                      </div>
                </article>

                <div className="filter-row" style={{ marginTop: "16px" }}>
                  {containers.map((c) => (
                    <button
                      key={c.id}
                      className={
                        selectedContainerId === c.id
                          ? "filter-pill filter-pill-active"
                          : "filter-pill"
                  }
                  onClick={() => {
                    setSelectedContainerId(c.id);
                    setSelectedId(null);
                    setUnlockCode("");
                    setUnlockCodeError("");
                    setBluetoothConnected(false);
                    setIsConnecting(false);
                    setBluetoothStatus("idle");
                    setBluetoothMessage("");
                  }}
                  >
                  {c.name}
                </button>
              ))}
            </div>
          </section>
              

              {(isLoadingMaterials || materialError) && (
                <section className="section">
                  <article className="card">
                    <h3>
                      {isLoadingMaterials ? "Hämtar material" : "Databasfel"}
                    </h3>
                    <p>
                      {isLoadingMaterials
                        ? "Materiallistan laddas från Supabase."
                        : materialError}
                    </p>
                    {materialError && (
                      <div className="item-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={fetchMaterials}
                        >
                          Försök igen
                        </button>
                      </div>
                    )}
                  </article>
                </section>
              )}

              <section className="section">
                <div className="section-heading">
                  <h2>Snabbåtgärder</h2>
                </div>

                <div className="action-grid">
                  <button
                    className="action-card action-card-button"
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

                  <button
                    className="action-card action-card-button"
                    type="button"
                    onClick={() => setScreen("log")}
                  >
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
                          <img
                            src={item.imageClass}
                            alt={item.name}
                            className="item-image"
                          />
                          <span className="item-tag">Redo</span>
                        </div>

                        <h3>{item.name}</h3>
                        <p>{item.details}</p>
                        <strong>{item.container}</strong>

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
                  {filteredItems.slice(0, 2).map((item) => (
                    <article className="item-card" key={item.id}>
                      <div className="item-card-top">
                        <img
                          src={item.imageClass}
                          alt={item.name}
                          className="item-image"
                        />
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
                  {containerName} • Det som finns tillgängligt på plats just nu.
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
                {isLoadingMaterials || materialError ? (
                  <article className="card">
                    <h3>
                      {isLoadingMaterials ? "Hämtar material" : "Databasfel"}
                    </h3>
                    <p>
                      {isLoadingMaterials
                        ? "Containerinnehållet laddas från Supabase."
                        : materialError}
                    </p>
                    {materialError && (
                      <div className="item-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={fetchMaterials}
                        >
                          Försök igen
                        </button>
                      </div>
                    )}
                  </article>
                ) : filteredItems.length > 0 ? (
                  <div className="container-list">
                    {filteredItems.map((item) => (
                      <article className="container-row" key={item.id}>
                        <img
                          src={item.imageClass}
                          alt={item.name}
                          className="item-image"
                        />
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
                ) : (
                  <article className="card">
                    <h3>Inget material hittades</h3>
                    <p>Det finns inga artiklar som matchar filtret.</p>
                  </article>
                )}
              </section>
            </>
          )}

          {screen === "inbox" && (
  <>
    <section className="section">

      {/* TOGGLE – LIGGER ÖVERST */}
      <div className="filter-row" style={{ marginBottom: "20px" }}>
        <button
          className={
            inboxMode === "seller"
              ? "filter-pill filter-pill-active"
              : "filter-pill"
          }
          onClick={() => setInboxMode("seller")}
        >
          Säljer
        </button>

        <button
          className={
            inboxMode === "buyer"
              ? "filter-pill filter-pill-active"
              : "filter-pill"
          }
          onClick={() => setInboxMode("buyer")}
        >
          Köper
        </button>
      </div>

      {/* RUBRIK */}
      <p className="eyebrow">Inkorg</p>

      <div style={{ borderBottom: "1px solid #ddd", margin: "18px 0 28px" }} />

      <h1 style={{ fontSize: "40px", marginBottom: "24px" }}>
        Du har 0 olästa
      </h1>

      {/* DYNAMISK TEXT */}
      <div style={{ marginBottom: "28px" }}>
        <h2>
          {inboxMode === "seller" ? "Säljer" : "Köper"}: 0 Olästa
        </h2>

        <p>
          Härligt! Du har läst alla meddelanden.
        </p>
      </div>

      <div style={{ borderBottom: "1px solid #ddd", margin: "18px 0 28px" }} />

      <div>
        <h2>
          {inboxMode === "seller" ? "Säljer" : "Köper"}: Alla meddelanden
        </h2>

        <p>Här var det tomt.</p>
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
                <p className="eyebrow">{selectedItem.container}</p>
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

                  {selectedItemContainer?.mode === "transport" && (
                    <div className="message-box">
                      Denna container transporteras till hub. Ingen individuell upphämtning.
                    </div>
                  )}

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
                      <p>Plats: {selectedItem.container}</p>
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
                            addEventLogItem({
                              title: "Okänd QR-kod",
                              description: `Koden ${scanInput || "saknas"} matchade ingen artikel.`,
                              status: "warning",
                            });
                            return;
                          }

                          addEventLogItem({
                            title: "Artikel öppnad via QR",
                            description: `${foundItem.name} öppnades från manuell QR-kod.`,
                            status: "info",
                            materialName: foundItem.name,
                          });
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
                  <p>Plats: {selectedItem.container}</p>
                  <p>Tilldelad: {selectedItem.assignedUser}</p>

                  <div className="item-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={confirmPickup}
                      disabled={isSavingPickup}
                    >
                      {isSavingPickup ? "Sparar..." : "Bekräfta upphämtning"}
                    </button>

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setPickupError("");
                        setScreen("detail");
                      }}
                      disabled={isSavingPickup}
                    >
                      Avbryt
                    </button>
                  </div>

                  {pickupError && (
                    <div className="message-box">
                      <p>{pickupError}</p>
                    </div>
                  )}
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

          {screen === "log" && (
            <>
              <section className="hero-panel hero-panel-compact">
                <button
                  className="back-link"
                  type="button"
                  onClick={() => setScreen("home")}
                >
                  ← Tillbaka
                </button>
                <p className="eyebrow">{containerName}</p>
                <h1>Händelselogg</h1>
                <p className="lead">
                  Senaste händelserna från skanning, verifiering och
                  upphämtning.
                </p>
              </section>

              <section className="section">
                <article className="card card-accent">
                  <h3>{eventLog.length} händelser</h3>
                  <p>Loggen sparas lokalt i prototypen under sessionen.</p>
                </article>
              </section>

              <section className="section section-tight">
                {eventLog.length > 0 ? (
                  <div className="event-list">
                    {eventLog.map((event) => (
                      <article className="event-row" key={event.id}>
                        <span
                          className={`event-dot event-dot-${event.status}`}
                        />
                        <div className="event-content">
                          <div className="event-top">
                            <h3>{event.title}</h3>
                            <span>{event.time}</span>
                          </div>
                          <p>{event.description}</p>
                          {event.materialName && (
                            <strong>{event.materialName}</strong>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <article className="card">
                    <h3>Inga händelser än</h3>
                    <p>
                      Loggen fylls på när någon skannar, verifierar eller
                      bekräftar en upphämtning.
                    </p>
                  </article>
                )}
              </section>
            </>
          )}

          {screen === "find" && (
            <>
              <section className="hero-panel hero-panel-compact">
                <button
                  className="back-link"
                  type="button"
                  onClick={() => setScreen("home")}
                >
                ← Tillbaka
                </button>
                <p className="eyebrow">Karta</p>
                <h1>Hitta</h1>
                <p className="lead">Här kan du hitta tillängliga container</p>
              </section>

              <section className="section">
                <IntMap />
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

          <button 
            className={screen === "find" ? "nav-item nav-item-active" : "nav-item"} 
            type="button"
            onClick={() => setScreen("find")}
          >
            Hitta
          </button>
          <button
          className={screen === "inbox" ? "nav-item nav-item-active" : "nav-item"}
          type="button"
          onClick={() => setScreen("inbox")}
          >
            Inkorg
          </button>
        </nav>
      </div>
    </main>
  );
}

export default App;
