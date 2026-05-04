import { useCallback, useEffect, useMemo, useState } from "react";
import QrScanner from "./components/QrScanner";
import IntMap from "./components/Map";
import { supabase } from "./lib/supabaseClient";

const untypedSupabase = supabase as any;

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
type ScanMode = "lookup" | "pickup" | "return";
type BrowseScreen = "home" | "container";
type ScanReturnScreen = BrowseScreen | "detail";
type EventStatus = "info" | "success" | "warning";
type MaterialStatus = "Redo" | "Uthyrbar" | "Hämtad" | "Kontroll";
type RentalStatus = "available" | "checked_out" | "inspection_needed";
type ConfirmAction = "pickup" | "rentalCheckout" | "rentalReturn";
type ReturnCondition = "ready" | "inspection_needed";

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

type RentalRecord = {
  materialId: string;
  currentHolder: string;
  rentalStatus: RentalStatus;
  dueAt: string | null;
  checkedOutAt: string | null;
  returnedAt: string | null;
  returnCondition: ReturnCondition | null;
  returnNotes: string;
};

type EventLogItem = {
  id: string;
  createdAt: string;
  time: string;
  title: string;
  description: string;
  status: EventStatus;
  materialName?: string;
  materialId?: string;
};

type Container = {
  id: number;
  name: string;
  mode: "pickup" | "transport";
  accessCode: string;
};

const currentUser = "Ali";

const normalizeCode = (value: string) => value.trim().toLowerCase();

const createTimeLabel = (value?: string) =>
  new Date(value ?? new Date().toISOString()).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDateInput = (value: Date) => value.toISOString().slice(0, 10);

const createDefaultDueDate = () => {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 14);
  return formatDateInput(nextDate);
};

const toDueAtIso = (value: string) =>
  value ? new Date(`${value}T12:00:00`).toISOString() : null;

const formatDateLabel = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("sv-SE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Ej satt";

const getReturnConditionLabel = (value?: ReturnCondition | null) =>
  value === "inspection_needed"
    ? "Behöver kontroll"
    : value === "ready"
      ? "Redo för ny uthyrning"
      : "Inte registrerat";

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<Material[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scanMode, setScanMode] = useState<ScanMode>("lookup");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>("pickup");
  const [eventLog, setEventLog] = useState<EventLogItem[]>([]);
  const [eventLogError, setEventLogError] = useState("");
  const [isLoadingEventLog, setIsLoadingEventLog] = useState(true);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [materialError, setMaterialError] = useState("");
  const [isSavingPickup, setIsSavingPickup] = useState(false);
  const [pickupError, setPickupError] = useState("");
  const [rentalDueDate, setRentalDueDate] = useState(createDefaultDueDate());
  const [returnCondition, setReturnCondition] =
    useState<ReturnCondition>("ready");
  const [returnNotes, setReturnNotes] = useState("");
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
  const [selectedContainerId, setSelectedContainerId] = useState<number | null>(
    null
  );
  const [rentalRecords, setRentalRecords] = useState<
    Record<string, RentalRecord>
  >({});
  const [isLoadingRentals, setIsLoadingRentals] = useState(true);
  const [rentalError, setRentalError] = useState("");
  const [bluetoothStatus, setBluetoothStatus] = useState<
    "idle" | "connecting" | "connected" | "unlocked" | "denied"
  >("idle");
  const [bluetoothMessage, setBluetoothMessage] = useState("");

  const currentContainer = containers.find(
    (container) => container.id === selectedContainerId
  );

  const containerName = currentContainer?.name ?? "Ingen vald container";

  const normalizeUnlockCode = (value: string) =>
    value.trim().replace(/\s+/g, "");

  const fetchMaterials = useCallback(async () => {
    setIsLoadingMaterials(true);
    setMaterialError("");

    const { data, error } = await supabase
      .from("materials")
      .select("*, containers(name)");

    if (error) {
      console.error("Error fetching materials:", error);
      setMaterialError("Kunde inte hämta material från databasen.");
      setIsLoadingMaterials(false);
      return;
    }

    const mappedData: Material[] = (data ?? []).map((column) => {
      const imagePath = column.image_class ?? "";
      const imageUrl = imagePath
        ? supabase.storage.from("images").getPublicUrl(imagePath).data.publicUrl
        : "";

      return {
        id: column.id,
        name: column.name,
        details: column.details ?? "",
        description: column.description ?? "",
        container: column.containers?.name ?? "",
        price: column.price ?? "",
        type: column.type ?? "buy",
        status: (column.status ?? "Kontroll") as MaterialStatus,
        imageClass: imageUrl,
        assignedUser: column.assigned_user ?? "",
        scanCode: column.scan_code ?? "",
      };
    });

    setItems(mappedData);
    setIsLoadingMaterials(false);
  }, []);

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

  const fetchRentalRecords = useCallback(async () => {
    setIsLoadingRentals(true);
    setRentalError("");

    const { data, error } = await untypedSupabase
      .from("rental_records")
      .select("*");

    if (error) {
      console.error("Error fetching rental records:", error);
      setRentalError("Kunde inte hämta hyresstatus från databasen.");
      setRentalRecords({});
      setIsLoadingRentals(false);
      return;
    }

    const mappedRecords = Object.fromEntries(
      ((data ?? []) as any[]).map((record) => [
        String(record.material_id),
        {
          materialId: String(record.material_id),
          currentHolder: String(record.current_holder ?? ""),
          rentalStatus: (record.rental_status ?? "available") as RentalStatus,
          dueAt: record.due_at ?? null,
          checkedOutAt: record.checked_out_at ?? null,
          returnedAt: record.returned_at ?? null,
          returnCondition: (record.return_condition ?? null) as ReturnCondition | null,
          returnNotes: String(record.return_notes ?? ""),
        } as RentalRecord,
      ])
    );

    setRentalRecords(mappedRecords);
    setIsLoadingRentals(false);
  }, []);

  const fetchEventLog = useCallback(async () => {
    setIsLoadingEventLog(true);
    setEventLogError("");

    const { data, error } = await untypedSupabase
      .from("material_events")
      .select(
        "id, created_at, title, description, event_status, material_name, material_id"
      )
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) {
      console.error("Error fetching event log:", error);
      setEventLogError("Kunde inte hämta händelseloggen från databasen.");
      setEventLog([]);
      setIsLoadingEventLog(false);
      return;
    }

    const mappedLog: EventLogItem[] = ((data ?? []) as any[]).map((event) => ({
      id: String(event.id),
      createdAt: String(event.created_at ?? new Date().toISOString()),
      time: createTimeLabel(event.created_at),
      title: String(event.title ?? "Händelse"),
      description: String(event.description ?? ""),
      status: (event.event_status ?? "info") as EventStatus,
      materialName: event.material_name ?? undefined,
      materialId: event.material_id ?? undefined,
    }));

    setEventLog(mappedLog);
    setIsLoadingEventLog(false);
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  useEffect(() => {
    fetchRentalRecords();
  }, [fetchRentalRecords]);

  useEffect(() => {
    fetchEventLog();
  }, [fetchEventLog]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const selectedItemContainer = useMemo(
    () =>
      containers.find((container) => container.name === selectedItem?.container) ??
      null,
    [containers, selectedItem]
  );

  const selectedRentalRecord = useMemo(
    () => (selectedItem ? rentalRecords[selectedItem.id] ?? null : null),
    [rentalRecords, selectedItem]
  );

  const getRentalRecord = (materialId: string) => rentalRecords[materialId] ?? null;

  const isRentalAvailable = (item: Material) => {
    const rentalRecord = getRentalRecord(item.id);
    return item.type === "rent" && (!rentalRecord || rentalRecord.rentalStatus === "available");
  };

  const isRentalCheckedOutToCurrentUser = (item: Material) => {
    const rentalRecord = getRentalRecord(item.id);

    return (
      item.type === "rent" &&
      rentalRecord?.rentalStatus === "checked_out" &&
      (rentalRecord.currentHolder || item.assignedUser) === currentUser
    );
  };

  const getItemStatusLabel = (item: Material) => {
    if (item.type !== "rent") {
      return item.status;
    }

    const rentalRecord = getRentalRecord(item.id);

    if (!rentalRecord || rentalRecord.rentalStatus === "available") {
      return "Uthyrbar";
    }

    if (rentalRecord.rentalStatus === "checked_out") {
      return "Ute på lån";
    }

    return "Returkontroll";
  };

  const isItemWaitingForInspection = (item: Material) =>
    item.status === "Kontroll" ||
    getRentalRecord(item.id)?.rentalStatus === "inspection_needed";

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
      userItems.filter((item) =>
        item.type === "rent" ? isRentalAvailable(item) : item.status === "Redo"
      ),
    [userItems, rentalRecords]
  );

  const activeRentals = useMemo(
    () => userItems.filter((item) => isRentalCheckedOutToCurrentUser(item)),
    [userItems, rentalRecords]
  );

  const ownReadyCount = readyForPickup.length;

  const persistEventLogItem = useCallback(
    async ({
      createdAt,
      title,
      description,
      status,
      materialName,
      materialId,
      containerId,
      eventType = "info_event",
      conditionState,
      dueAt,
      metadata,
    }: {
      createdAt: string;
      title: string;
      description: string;
      status: EventStatus;
      materialName?: string;
      materialId?: string;
      containerId?: number | null;
      eventType?: string;
      conditionState?: string | null;
      dueAt?: string | null;
      metadata?: Record<string, string | null>;
    }) => {
      const { error } = await untypedSupabase.from("material_events").insert({
        material_id: materialId ?? null,
        container_id: containerId ?? null,
        event_type: eventType,
        event_status: status,
        title,
        description,
        actor_name: currentUser,
        material_name: materialName ?? null,
        condition_state: conditionState ?? null,
        due_at: dueAt ?? null,
        created_at: createdAt,
        metadata: metadata ?? {},
      });

      if (error) {
        console.error("Error saving event log:", error);
      }
    },
    []
  );

  const addEventLogItem = ({
    title,
    description,
    status = "info",
    materialName,
    materialId,
    containerId,
    eventType,
    conditionState,
    dueAt,
    metadata,
    persist = true,
  }: {
    title: string;
    description: string;
    status?: EventStatus;
    materialName?: string;
    materialId?: string;
    containerId?: number | null;
    eventType?: string;
    conditionState?: string | null;
    dueAt?: string | null;
    metadata?: Record<string, string | null>;
    persist?: boolean;
  }) => {
    const createdAt = new Date().toISOString();

    setEventLog((prev) => [
      {
        id: `${Date.now()}-${prev.length}`,
        createdAt,
        time: createTimeLabel(createdAt),
        title,
        description,
        status,
        materialName,
        materialId,
      },
      ...prev,
    ]);

    if (persist) {
      void persistEventLogItem({
        createdAt,
        title,
        description,
        status,
        materialName,
        materialId,
        containerId,
        eventType,
        conditionState,
        dueAt,
        metadata,
      });
    }
  };

  const syncLocalMaterialStatus = (materialId: string, nextStatus: MaterialStatus) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === materialId ? { ...item, status: nextStatus } : item
      )
    );
  };

  const syncLocalRentalRecord = (materialId: string, nextRecord: Partial<RentalRecord>) => {
    setRentalRecords((prev) => {
      const previousRecord = prev[materialId];
      const mergedRecord: RentalRecord = {
        materialId,
        currentHolder: previousRecord?.currentHolder ?? "",
        rentalStatus: previousRecord?.rentalStatus ?? "available",
        dueAt: previousRecord?.dueAt ?? null,
        checkedOutAt: previousRecord?.checkedOutAt ?? null,
        returnedAt: previousRecord?.returnedAt ?? null,
        returnCondition: previousRecord?.returnCondition ?? null,
        returnNotes: previousRecord?.returnNotes ?? "",
        ...nextRecord,
      };

      return {
        ...prev,
        [materialId]: mergedRecord,
      };
    });
  };

  const resetScanState = () => {
    setHasScanned(false);
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

  const openActionScan = (itemId: string, mode: Exclude<ScanMode, "lookup">) => {
    setSelectedId(itemId);
    setScanMode(mode);
    setScanReturnScreen("detail");
    resetScanState();
    setScreen("scan");
  };

  const verifyMaterialAction = (
    requestedMode: Exclude<ScanMode, "lookup">,
    codeValue: string = scanInput,
    itemOverride?: Material | null
  ) => {
    const targetItem =
      itemOverride ?? selectedItem ?? lookupItemByCode(codeValue);

    if (!targetItem) {
      setVerifyMessage("⚠️ Ingen artikel matchade QR-koden.");
      addEventLogItem({
        title: "Okänd QR-kod",
        description: `Koden ${codeValue || "saknas"} matchade ingen artikel.`,
        status: "warning",
        eventType: "unknown_qr",
      });
      return false;
    }

    const targetContainer =
      containers.find((container) => container.name === targetItem.container) ??
      null;
    const targetRentalRecord = getRentalRecord(targetItem.id);

    setSelectedId(targetItem.id);

    if (targetContainer?.mode === "transport") {
      setVerifyMessage(
        "Denna container transporteras till hub – ingen upphämtning eller retur."
      );
      return false;
    }

    if (normalizeCode(codeValue) !== normalizeCode(targetItem.scanCode)) {
      setVerifyMessage(
        "⚠️ Fel materialkod – kontrollera att du har rätt artikel."
      );
      addEventLogItem({
        title: "Fel QR-kod",
        description: `Koden matchade inte ${targetItem.name}.`,
        status: "warning",
        materialName: targetItem.name,
        materialId: targetItem.id,
        containerId: targetContainer?.id ?? null,
        eventType: "wrong_qr",
      });
      return false;
    }

    if (requestedMode === "pickup") {
      if (targetItem.assignedUser !== currentUser) {
        setVerifyMessage("❌ Fel användare – materialet är inte tilldelat dig.");
        addEventLogItem({
          title: "Upphämtning nekad",
          description: `${targetItem.name} är tilldelad ${targetItem.assignedUser}.`,
          status: "warning",
          materialName: targetItem.name,
          materialId: targetItem.id,
          containerId: targetContainer?.id ?? null,
          eventType: "pickup_denied_wrong_user",
        });
        return false;
      }

      if (targetItem.type === "rent") {
        if (targetRentalRecord?.rentalStatus === "checked_out") {
          const holderName =
            targetRentalRecord.currentHolder || targetItem.assignedUser;
          const isHeldByCurrentUser = holderName === currentUser;

          setVerifyMessage(
            isHeldByCurrentUser
              ? "ℹ️ Artikeln är redan uthyrd till dig. Registrera retur i stället."
              : `⚠️ Artikeln är redan uthyrd till ${holderName}.`
          );

          addEventLogItem({
            title: "Uthyrning stoppad",
            description: isHeldByCurrentUser
              ? `${targetItem.name} är redan uthyrd till ${currentUser}.`
              : `${targetItem.name} är redan uthyrd till ${holderName}.`,
            status: "warning",
            materialName: targetItem.name,
            materialId: targetItem.id,
            containerId: targetContainer?.id ?? null,
            eventType: "rental_checkout_blocked",
          });
          return false;
        }

        if (
          targetRentalRecord?.rentalStatus === "inspection_needed" ||
          targetItem.status === "Kontroll"
        ) {
          setVerifyMessage(
            "⚠️ Artikeln väntar på kontroll innan den kan hyras ut igen."
          );
          addEventLogItem({
            title: "Uthyrning stoppad",
            description: `${targetItem.name} väntar på kontroll innan nästa uthyrning.`,
            status: "warning",
            materialName: targetItem.name,
            materialId: targetItem.id,
            containerId: targetContainer?.id ?? null,
            eventType: "rental_checkout_waiting_inspection",
          });
          return false;
        }

        setConfirmAction("rentalCheckout");
        setRentalDueDate(createDefaultDueDate());
        setReturnCondition("ready");
        setReturnNotes("");
        addEventLogItem({
          title: "Uthyrning verifierad",
          description: `${targetItem.name} verifierades för uthyrning till ${currentUser}.`,
          status: "success",
          materialName: targetItem.name,
          materialId: targetItem.id,
          containerId: targetContainer?.id ?? null,
          eventType: "rental_checkout_verified",
        });
      } else {
        if (targetItem.status === "Kontroll") {
          setVerifyMessage("⚠️ Materialet väntar fortfarande på kontroll.");
          addEventLogItem({
            title: "Upphämtning stoppad",
            description: `${targetItem.name} väntar fortfarande på kontroll.`,
            status: "warning",
            materialName: targetItem.name,
            materialId: targetItem.id,
            containerId: targetContainer?.id ?? null,
            eventType: "pickup_waiting_inspection",
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
            materialId: targetItem.id,
            containerId: targetContainer?.id ?? null,
            eventType: "pickup_already_done",
          });
          return false;
        }

        setConfirmAction("pickup");
        addEventLogItem({
          title: "Verifiering godkänd",
          description: `${targetItem.name} verifierades för ${currentUser}.`,
          status: "success",
          materialName: targetItem.name,
          materialId: targetItem.id,
          containerId: targetContainer?.id ?? null,
          eventType: "pickup_verified",
        });
      }
    }

    if (requestedMode === "return") {
      if (targetItem.type !== "rent") {
        setVerifyMessage("⚠️ Endast hyrmaterial kan returneras i detta flöde.");
        return false;
      }

      if (
        !targetRentalRecord ||
        targetRentalRecord.rentalStatus !== "checked_out"
      ) {
        setVerifyMessage("⚠️ Ingen aktiv uthyrning hittades för artikeln.");
        addEventLogItem({
          title: "Retur stoppad",
          description: `${targetItem.name} saknar en aktiv uthyrning att returnera.`,
          status: "warning",
          materialName: targetItem.name,
          materialId: targetItem.id,
          containerId: targetContainer?.id ?? null,
          eventType: "rental_return_missing_checkout",
        });
        return false;
      }

      const responsibleUser =
        targetRentalRecord.currentHolder || targetItem.assignedUser;

      if (responsibleUser !== currentUser) {
        setVerifyMessage("❌ Fel användare – du är inte ansvarig för returen.");
        addEventLogItem({
          title: "Retur nekad",
          description: `${targetItem.name} är registrerad på ${responsibleUser}.`,
          status: "warning",
          materialName: targetItem.name,
          materialId: targetItem.id,
          containerId: targetContainer?.id ?? null,
          eventType: "rental_return_wrong_user",
        });
        return false;
      }

      setConfirmAction("rentalReturn");
      setReturnCondition("ready");
      setReturnNotes("");
      addEventLogItem({
        title: "Retur verifierad",
        description: `${targetItem.name} verifierades för retur av ${currentUser}.`,
        status: "success",
        materialName: targetItem.name,
        materialId: targetItem.id,
        containerId: targetContainer?.id ?? null,
        eventType: "rental_return_verified",
      });
    }

    setVerifyMessage("");
    setScreen("confirm");
    return true;
  };

  const handleScanResult = (text: string) => {
    if (hasScanned) return;

    setHasScanned(true);
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
          eventType: "unknown_qr",
        });
        return;
      }

      addEventLogItem({
        title: "Artikel öppnad via QR",
        description: `${foundItem.name} öppnades från QR-skanning.`,
        status: "info",
        materialName: foundItem.name,
        materialId: foundItem.id,
        containerId:
          containers.find((container) => container.name === foundItem.container)?.id ??
          null,
        eventType: "lookup_qr",
      });
      setSelectedId(foundItem.id);
      setDetailReturnScreen(
        scanReturnScreen === "container" ? "container" : "home"
      );
      setScreen("detail");
      return;
    }

    verifyMaterialAction(scanMode, text);
  };

  const handleScannerError = (message: string) => {
    setVerifyMessage(`⚠️ ${message}`);
    addEventLogItem({
      title: "Kamera kunde inte starta",
      description: message,
      status: "warning",
      eventType: "scanner_error",
    });
    setScannerEnabled(false);
  };

  const confirmSelectedAction = async () => {
    if (!selectedItem) return;

    if (confirmAction === "rentalCheckout" && !rentalDueDate) {
      setPickupError("Välj en senaste returdag innan uthyrningen registreras.");
      return;
    }

    setIsSavingPickup(true);
    setPickupError("");

    const rpcAction =
      confirmAction === "pickup"
        ? "pickup"
        : confirmAction === "rentalCheckout"
          ? "rental_checkout"
          : "rental_return";

    const { data, error } = await untypedSupabase.rpc("process_material_action", {
      p_action: rpcAction,
      p_material_id: selectedItem.id,
      p_actor_name: currentUser,
      p_due_at:
        confirmAction === "rentalCheckout" ? toDueAtIso(rentalDueDate) : null,
      p_return_condition:
        confirmAction === "rentalReturn" ? returnCondition : null,
      p_return_notes:
        confirmAction === "rentalReturn" ? returnNotes.trim() || null : null,
    });

    if (error) {
      console.error("Error processing material action:", error);

      const errorLabel =
        confirmAction === "pickup"
          ? "upphämtningen"
          : confirmAction === "rentalCheckout"
            ? "uthyrningen"
            : "returen";

      setPickupError(`Kunde inte spara ${errorLabel} i databasen.`);
      addEventLogItem({
        title: "Åtgärden kunde inte sparas",
        description:
          error?.message ?? `${selectedItem.name} uppdaterades inte i databasen.`,
        status: "warning",
        materialName: selectedItem.name,
        materialId: selectedItem.id,
        containerId: selectedItemContainer?.id ?? null,
        eventType: "action_save_failed",
      });
      setIsSavingPickup(false);
      return;
    }

    const nextStatus = String(data?.material_status ?? "") as MaterialStatus;

    if (nextStatus) {
      syncLocalMaterialStatus(selectedItem.id, nextStatus);
    }

    if (selectedItem.type === "rent") {
      syncLocalRentalRecord(selectedItem.id, {
        currentHolder: String(data?.current_holder ?? ""),
        rentalStatus: (data?.rental_status ?? "available") as RentalStatus,
        dueAt: data?.due_at ?? null,
        checkedOutAt: data?.checked_out_at ?? null,
        returnedAt: data?.returned_at ?? null,
        returnCondition: (data?.return_condition ?? null) as ReturnCondition | null,
        returnNotes: String(data?.return_notes ?? ""),
      });
    }

    await fetchEventLog();
    setIsSavingPickup(false);
    setScreen("complete");
  };

  const currentScanBackScreen =
    scanReturnScreen === "detail" ? "detail" : scanReturnScreen;

  const currentDetailMessage = (() => {
    if (!selectedItem) return "";

    if (selectedItemContainer?.mode === "transport") {
      return "Denna container transporteras till hub. Ingen individuell upphämtning eller retur kan registreras här.";
    }

    if (selectedItem.type === "rent") {
      if (selectedRentalRecord?.rentalStatus === "checked_out") {
        const holderName =
          selectedRentalRecord.currentHolder || selectedItem.assignedUser;
        const dueLabel = formatDateLabel(selectedRentalRecord.dueAt);

        return holderName === currentUser
          ? `Artikeln är uthyrd till dig. Registrera retur senast ${dueLabel}.`
          : `Artikeln är uthyrd till ${holderName} till ${dueLabel}.`;
      }

      if (
        selectedRentalRecord?.rentalStatus === "inspection_needed" ||
        selectedItem.status === "Kontroll"
      ) {
        return "Returerat material väntar på kontroll innan det kan hyras ut igen.";
      }

      if (selectedItem.assignedUser !== currentUser) {
        return `Artikeln är reserverad för ${selectedItem.assignedUser}.`;
      }

      return "Artikeln kan checkas ut på hyra. Returdatum och ansvar registreras i nästa steg.";
    }

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

  const detailPrimaryAction = (() => {
    if (!selectedItem) {
      return {
        label: "Skanna och verifiera",
        enabled: false,
        mode: "pickup" as Exclude<ScanMode, "lookup">,
      };
    }

    if (selectedItem.type === "rent") {
      if (selectedRentalRecord?.rentalStatus === "checked_out") {
        const holderName =
          selectedRentalRecord.currentHolder || selectedItem.assignedUser;

        return {
          label: "Skanna och registrera retur",
          enabled:
            bluetoothStatus === "unlocked" &&
            selectedItemContainer?.mode === "pickup" &&
            holderName === currentUser,
          mode: "return" as Exclude<ScanMode, "lookup">,
        };
      }

      if (
        selectedRentalRecord?.rentalStatus === "inspection_needed" ||
        selectedItem.status === "Kontroll"
      ) {
        return {
          label: "Väntar på kontroll",
          enabled: false,
          mode: "pickup" as Exclude<ScanMode, "lookup">,
        };
      }

      return {
        label: "Skanna och checka ut",
        enabled:
          bluetoothStatus === "unlocked" &&
          selectedItemContainer?.mode === "pickup" &&
          selectedItem.assignedUser === currentUser,
        mode: "pickup" as Exclude<ScanMode, "lookup">,
      };
    }

    return {
      label: "Skanna och verifiera",
      enabled:
        bluetoothStatus === "unlocked" &&
        selectedItemContainer?.mode === "pickup" &&
        selectedItem.assignedUser === currentUser &&
        selectedItem.status !== "Hämtad" &&
        selectedItem.status !== "Kontroll",
      mode: "pickup" as Exclude<ScanMode, "lookup">,
    };
  })();

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
        containerId: currentContainer.id,
        eventType: "container_denied_transport",
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
        containerId: currentContainer.id,
        eventType: "container_code_missing",
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
        containerId: currentContainer.id,
        eventType: "container_code_wrong",
      });
      return;
    }

    setIsConnecting(true);
    setBluetoothStatus("connecting");
    setBluetoothMessage(
      `Kod verifierad. Ansluter till ${containerName} via Bluetooth...`
    );

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
          containerId: currentContainer.id,
          eventType: "container_unlocked",
        });
      }, 1000);
    }, 1200);
  };

  const detailStatusLabel = selectedItem ? getItemStatusLabel(selectedItem) : "";
  const confirmHeading =
    confirmAction === "pickup"
      ? {
          eyebrow: "Bekräfta",
          title: "Bekräfta upphämtning",
          lead: "Kontrollera en sista gång innan upphämtningen registreras.",
        }
      : confirmAction === "rentalCheckout"
        ? {
            eyebrow: "Bekräfta uthyrning",
            title: "Bekräfta uthyrning",
            lead: "Returdatum och ansvar registreras innan materialet lämnar containern.",
          }
        : {
            eyebrow: "Bekräfta retur",
            title: "Bekräfta retur",
            lead: "Registrera skick och anteckningar innan materialet blir tillgängligt igen.",
          };

  const completeHeading =
    confirmAction === "pickup"
      ? {
          eyebrow: "Klart",
          title: "Upphämtning genomförd",
          lead: "Materialet har markerats som upphämtat i systemet.",
          body: "Status har uppdaterats till Hämtad.",
        }
      : confirmAction === "rentalCheckout"
        ? {
            eyebrow: "Klart",
            title: "Uthyrning registrerad",
            lead: "Uthyrningen har sparats tillsammans med returdatum och ansvarig användare.",
            body: `Retur senast ${formatDateLabel(toDueAtIso(rentalDueDate))}.`,
          }
        : {
            eyebrow: "Klart",
            title: "Retur registrerad",
            lead: "Returen har sparats och materialets nästa steg är uppdaterat.",
            body:
              returnCondition === "inspection_needed"
                ? "Status har uppdaterats till Kontroll."
                : "Status har uppdaterats till Uthyrbar.",
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
                  Självbetjäning för container, verifiering av upphämtning och
                  uthyrning med beständig spårbarhet.
                </p>

                <article className="site-summary">
                  <div className="site-summary-row">
                    <span>{containerName}</span>
                    <span>Tillgänglig</span>
                  </div>

                  <strong>Inloggad: {currentUser}</strong>

                  <div className="badge-row">
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
                        bluetoothStatus === "connected" ||
                        bluetoothStatus === "unlocked"
                          ? "bluetooth-badge bluetooth-connected"
                          : bluetoothStatus === "denied"
                            ? "bluetooth-badge bluetooth-denied"
                            : "bluetooth-badge bluetooth-disconnected"
                      }
                    >
                      {bluetoothStatus === "connected" ||
                      bluetoothStatus === "unlocked"
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
                        ? `${ownReadyCount} artiklar redo för upphämtning eller uthyrning`
                        : "Inga artiklar redo för upphämtning just nu"
                      : "Containern väntar på transport till hub"}
                  </p>

                  {currentContainer?.mode === "transport" && (
                    <div className="message-box" style={{ marginTop: "12px" }}>
                      <p>
                        Denna container är i transportläge och kan inte öppnas
                        för individuell upphämtning.
                      </p>
                    </div>
                  )}

                  <div className="unlock-panel">
                    <label
                      className="unlock-label"
                      htmlFor="container-unlock-code"
                    >
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
                      <p>{bluetoothMessage}</p>
                    </div>
                  )}

                  <div
                    className="message-box message-box-soft"
                    style={{ marginTop: "12px" }}
                  >
                    <p>
                      QR används för att verifiera material. Bluetooth används
                      för att öppna containern. Händelser sparas i Supabase för
                      spårbarhet.
                    </p>
                  </div>
                </article>

                <div className="filter-row" style={{ marginTop: "16px" }}>
                  {containers.map((container) => (
                    <button
                      key={container.id}
                      className={
                        selectedContainerId === container.id
                          ? "filter-pill filter-pill-active"
                          : "filter-pill"
                      }
                      onClick={() => {
                        setSelectedContainerId(container.id);
                        setSelectedId(null);
                        setUnlockCode("");
                        setUnlockCodeError("");
                        setBluetoothConnected(false);
                        setIsConnecting(false);
                        setBluetoothStatus("idle");
                        setBluetoothMessage("");
                      }}
                    >
                      {container.name}
                    </button>
                  ))}
                </div>
              </section>

              {(isLoadingMaterials ||
                isLoadingRentals ||
                materialError ||
                rentalError ||
                containerError) && (
                <section className="section">
                  <article className="card">
                    <h3>
                      {isLoadingMaterials || isLoadingRentals
                        ? "Hämtar data"
                        : "Databasfel"}
                    </h3>
                    <p>
                      {isLoadingMaterials || isLoadingRentals
                        ? "Material, hyresstatus och containerdata laddas från Supabase."
                        : materialError || rentalError || containerError}
                    </p>
                    {(materialError || rentalError || containerError) && (
                      <div className="item-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            void fetchMaterials();
                            void fetchRentalRecords();
                            void fetchContainers();
                          }}
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
                          <span
                            className={
                              item.type === "rent"
                                ? "item-tag item-tag-rental"
                                : "item-tag"
                            }
                          >
                            {item.type === "rent" ? "Hyra" : "Redo"}
                          </span>
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
                    <p>
                      Det finns inga artiklar som väntar på upphämtning eller
                      uthyrning.
                    </p>
                  </article>
                )}
              </section>

              <section className="section">
                <div className="section-heading">
                  <h2>Pågående hyror</h2>
                </div>

                {activeRentals.length > 0 ? (
                  <div className="item-list">
                    {activeRentals.map((item) => {
                      const rentalRecord = getRentalRecord(item.id);

                      return (
                        <article className="item-card" key={item.id}>
                          <div className="item-card-top">
                            <img
                              src={item.imageClass}
                              alt={item.name}
                              className="item-image"
                            />
                            <span className="item-tag item-tag-rental">
                              Pågående hyra
                            </span>
                          </div>

                          <h3>{item.name}</h3>
                          <p>{item.details}</p>
                          <strong>
                            Retur senast {formatDateLabel(rentalRecord?.dueAt)}
                          </strong>

                          <div className="inline-actions">
                            <button
                              className="text-link"
                              type="button"
                              onClick={() => openDetail(item.id, "home")}
                            >
                              Registrera retur
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <article className="card">
                    <h3>Inga pågående hyror</h3>
                    <p>Du har inga uthyrda artiklar som väntar på retur.</p>
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

                      <div className="container-row-bottom" style={{ marginTop: "12px" }}>
                        <span
                          className={
                            isItemWaitingForInspection(item)
                              ? "status-pill status-pill-soft"
                              : "status-pill"
                          }
                        >
                          {getItemStatusLabel(item)}
                        </span>
                      </div>

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
                {isLoadingMaterials || isLoadingRentals || materialError ? (
                  <article className="card">
                    <h3>
                      {isLoadingMaterials || isLoadingRentals
                        ? "Hämtar material"
                        : "Databasfel"}
                    </h3>
                    <p>
                      {isLoadingMaterials || isLoadingRentals
                        ? "Containerinnehållet laddas från Supabase."
                        : materialError || rentalError}
                    </p>
                    {(materialError || rentalError) && (
                      <div className="item-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            void fetchMaterials();
                            void fetchRentalRecords();
                          }}
                        >
                          Försök igen
                        </button>
                      </div>
                    )}
                  </article>
                ) : filteredItems.length > 0 ? (
                  <div className="container-list">
                    {filteredItems.map((item) => {
                      const statusLabel = getItemStatusLabel(item);

                      return (
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
                                  isItemWaitingForInspection(item)
                                    ? "status-pill status-pill-soft"
                                    : "status-pill"
                                }
                              >
                                {statusLabel}
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
                      );
                    })}
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

                <p className="eyebrow">Inkorg</p>
                <div style={{ borderBottom: "1px solid #ddd", margin: "18px 0 28px" }} />

                <h1 style={{ fontSize: "40px", marginBottom: "24px" }}>
                  Du har 0 olästa
                </h1>

                <div style={{ marginBottom: "28px" }}>
                  <h2>{inboxMode === "seller" ? "Säljer" : "Köper"}: 0 Olästa</h2>
                  <p>Härligt! Du har läst alla meddelanden.</p>
                </div>

                <div style={{ borderBottom: "1px solid #ddd", margin: "18px 0 28px" }} />

                <div>
                  <h2>{inboxMode === "seller" ? "Säljer" : "Köper"}: Alla meddelanden</h2>
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
                      <strong>{detailStatusLabel}</strong>
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

                    {selectedItem.type === "rent" && (
                      <>
                        <div className="detail-row">
                          <span>Aktiv innehavare</span>
                          <strong>
                            {selectedRentalRecord?.currentHolder
                              ? selectedRentalRecord.currentHolder
                              : "Ingen aktiv hyra"}
                          </strong>
                        </div>
                        <div className="detail-row">
                          <span>Retur senast</span>
                          <strong>{formatDateLabel(selectedRentalRecord?.dueAt)}</strong>
                        </div>
                        <div className="detail-row">
                          <span>Returbedömning</span>
                          <strong>
                            {getReturnConditionLabel(
                              selectedRentalRecord?.returnCondition
                            )}
                          </strong>
                        </div>
                        {selectedRentalRecord?.returnNotes && (
                          <div className="detail-row">
                            <span>Senaste anteckning</span>
                            <strong>{selectedRentalRecord.returnNotes}</strong>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="message-box message-box-soft">
                    <p>{currentDetailMessage}</p>
                  </div>

                  {selectedItemContainer?.mode === "transport" && (
                    <div className="message-box">
                      <p>
                        Denna container transporteras till hub. Ingen individuell
                        upphämtning.
                      </p>
                    </div>
                  )}

                  <div className="item-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() =>
                        openActionScan(selectedItem.id, detailPrimaryAction.mode)
                      }
                      disabled={!detailPrimaryAction.enabled}
                    >
                      {detailPrimaryAction.label}
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
                  {scanMode === "lookup"
                    ? "Skanna"
                    : scanMode === "pickup"
                      ? selectedItem?.type === "rent"
                        ? "Uthyrning"
                        : "Verifiering"
                      : "Retur"}
                </p>
                <h1>
                  {scanMode === "lookup"
                    ? "Skanna QR-kod"
                    : scanMode === "pickup"
                      ? selectedItem?.type === "rent"
                        ? "Verifiera uthyrning"
                        : "Verifiera upphämtning"
                      : "Verifiera retur"}
                </h1>
                <p className="lead">
                  {scanMode === "lookup"
                    ? "Skanna en QR-kod för att öppna rätt artikel direkt."
                    : scanMode === "pickup"
                      ? selectedItem?.type === "rent"
                        ? "Skanna QR-koden på artikeln för att checka ut den på hyra."
                        : "Skanna QR-koden på artikeln för att kontrollera upphämtningen."
                      : "Skanna QR-koden på hyrmaterialet för att registrera retur."}
                </p>
              </section>

              <section className="section">
                <article className="card">
                  {scanMode !== "lookup" && selectedItem ? (
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
                      {selectedItem.type === "rent" && (
                        <p>
                          Retur senast:{" "}
                          <strong>{formatDateLabel(selectedRentalRecord?.dueAt)}</strong>
                        </p>
                      )}
                      <p>
                        Testkod: <strong>{selectedItem.scanCode}</strong>
                      </p>
                    </div>
                  ) : (
                    <div className="scan-target">
                      <h3>Skanna en artikel</h3>
                      <p>
                        Testa till exempel QR-koden för <strong>door-12</strong>{" "}
                        för att öppna artikeln direkt.
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
                              eventType: "unknown_qr",
                            });
                            return;
                          }

                          addEventLogItem({
                            title: "Artikel öppnad via QR",
                            description: `${foundItem.name} öppnades från manuell QR-kod.`,
                            status: "info",
                            materialName: foundItem.name,
                            materialId: foundItem.id,
                            containerId:
                              containers.find(
                                (container) => container.name === foundItem.container
                              )?.id ?? null,
                            eventType: "lookup_manual",
                          });
                          setSelectedId(foundItem.id);
                          setDetailReturnScreen(
                            scanReturnScreen === "container" ? "container" : "home"
                          );
                          setScreen("detail");
                          return;
                        }

                        verifyMaterialAction(scanMode, scanInput);
                      }}
                    >
                      {scanMode === "lookup"
                        ? "Öppna artikel"
                        : scanMode === "return"
                          ? "Verifiera retur"
                          : selectedItem?.type === "rent"
                            ? "Verifiera uthyrning"
                            : "Verifiera"}
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
                <p className="eyebrow">{confirmHeading.eyebrow}</p>
                <h1>{confirmHeading.title}</h1>
                <p className="lead">{confirmHeading.lead}</p>
              </section>

              <section className="section">
                <article className="card card-highlight">
                  <h3>{selectedItem.name}</h3>
                  <p>{selectedItem.details}</p>
                  <p>Plats: {selectedItem.container}</p>
                  <p>Tilldelad: {selectedItem.assignedUser}</p>

                  {confirmAction === "rentalCheckout" && (
                    <div className="item-actions">
                      <label className="unlock-label" htmlFor="rental-due-date">
                        Senaste returdag
                      </label>
                      <input
                        id="rental-due-date"
                        className="form-input"
                        type="date"
                        value={rentalDueDate}
                        onChange={(event) => setRentalDueDate(event.target.value)}
                      />
                      <p className="support-text">
                        Returdatumet sparas i systemet och följer med i
                        spårbarhetsloggen.
                      </p>
                    </div>
                  )}

                  {confirmAction === "rentalReturn" && (
                    <div className="item-actions">
                      <label className="unlock-label" htmlFor="return-condition">
                        Returstatus
                      </label>
                      <select
                        id="return-condition"
                        className="form-input form-select"
                        value={returnCondition}
                        onChange={(event) =>
                          setReturnCondition(
                            event.target.value as ReturnCondition
                          )
                        }
                      >
                        <option value="ready">Redo för ny uthyrning</option>
                        <option value="inspection_needed">
                          Behöver kontroll
                        </option>
                      </select>

                      <label className="unlock-label" htmlFor="return-notes">
                        Anteckning om skick
                      </label>
                      <textarea
                        id="return-notes"
                        className="form-input form-textarea"
                        placeholder="Skriv till exempel om materialet behöver rengöras, lagas eller kontrolleras."
                        value={returnNotes}
                        onChange={(event) => setReturnNotes(event.target.value)}
                      />
                    </div>
                  )}

                  <div className="item-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={confirmSelectedAction}
                      disabled={isSavingPickup}
                    >
                      {isSavingPickup
                        ? "Sparar..."
                        : confirmAction === "pickup"
                          ? "Bekräfta upphämtning"
                          : confirmAction === "rentalCheckout"
                            ? "Bekräfta uthyrning"
                            : "Bekräfta retur"}
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
                <p className="eyebrow">{completeHeading.eyebrow}</p>
                <h1>{completeHeading.title}</h1>
                <p className="lead">{completeHeading.lead}</p>
              </section>

              <section className="section">
                <article className="card card-accent">
                  <h3>{selectedItem.name}</h3>
                  <p>{completeHeading.body}</p>

                  <div className="item-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        resetScanState();
                        setRentalDueDate(createDefaultDueDate());
                        setReturnCondition("ready");
                        setReturnNotes("");
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
                  Senaste händelserna från skanning, verifiering, uthyrning,
                  retur och upphämtning.
                </p>
              </section>

              <section className="section">
                <article className="card card-accent">
                  <h3>{eventLog.length} händelser</h3>
                  <p>Loggen sparas i Supabase och kan följas mellan sessioner.</p>
                </article>
              </section>

              <section className="section section-tight">
                {isLoadingEventLog ? (
                  <article className="card">
                    <h3>Hämtar logg</h3>
                    <p>Händelserna laddas från databasen.</p>
                  </article>
                ) : eventLogError ? (
                  <article className="card">
                    <h3>Loggen kunde inte laddas</h3>
                    <p>{eventLogError}</p>
                    <div className="item-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => void fetchEventLog()}
                      >
                        Försök igen
                      </button>
                    </div>
                  </article>
                ) : eventLog.length > 0 ? (
                  <div className="event-list">
                    {eventLog.map((event) => (
                      <article className="event-row" key={event.id}>
                        <span className={`event-dot event-dot-${event.status}`} />
                        <div className="event-content">
                          <div className="event-top">
                            <h3>{event.title}</h3>
                            <span>{event.time}</span>
                          </div>
                          <p>{event.description}</p>
                          {event.materialName && <strong>{event.materialName}</strong>}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <article className="card">
                    <h3>Inga händelser än</h3>
                    <p>
                      Loggen fylls på när någon skannar, verifierar, hyr ut,
                      returnerar eller bekräftar en upphämtning.
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
                <p className="lead">Här kan du hitta tillgängliga containrar.</p>
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
