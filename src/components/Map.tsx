import { useEffect, useMemo, useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "../lib/supabaseClient";

type Container = {
  id: number;
  name: string;
  address: string | null;
  longitude: number | null;
  latitude: number | null;
};

export default function IntMap() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [selected, setSelected] = useState<Container | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchContainers = async () => {
      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("containers")
        .select("id, name, address, longitude, latitude")
        .order("name");

      if (error) {
        console.error("Error fetching containers:", error);
        setErrorMessage("Kunde inte hämta containrar från databasen.");
        setIsLoading(false);
        return;
      }

      setContainers(data ?? []);
      setIsLoading(false);
    };

    fetchContainers();
  }, []);

  const mappedContainers = useMemo(
    () =>
      containers.filter(
        (container): container is Container & {
          longitude: number;
          latitude: number;
        } => container.longitude !== null && container.latitude !== null
      ),
    [containers]
  );

  const initialViewState = useMemo(() => {
    if (mappedContainers.length > 0) {
      return {
        longitude: mappedContainers[0].longitude,
        latitude: mappedContainers[0].latitude,
        zoom: 12,
      };
    }

    return {
      longitude: 17.647069,
      latitude: 59.839263,
      zoom: 10,
    };
  }, [mappedContainers]);

  if (isLoading) {
    return <p>Laddar karta...</p>;
  }

  if (errorMessage) {
    return <p>{errorMessage}</p>;
  }

  return (
    <div style={{ width: "100%", height: "500px" }}>
      <Map
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
      >
        <NavigationControl position="top-right" />

        {mappedContainers.map((container) => (
          <Marker
            key={container.id}
            longitude={container.longitude}
            latitude={container.latitude}
            anchor="bottom"
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              setSelected((current) =>
                current?.id === container.id ? null : container
              );
            }}
          >
            <button
              type="button"
              style={{
                padding: 0,
                background: "none",
                border: "none",
              }}
              aria-label={container.name}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  backgroundColor: "#18a0f5",
                  borderRadius: "50% 50% 50% 0",
                  transform: "rotate(-45deg)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor: "white",
                    borderRadius: "50%",
                    position: "absolute",
                    top: "6px",
                    left: "6px",
                  }}
                />
              </div>
            </button>
          </Marker>
        ))}

        {selected && selected.longitude !== null && selected.latitude !== null && (
          <Popup
            longitude={selected.longitude}
            latitude={selected.latitude}
            anchor="top"
            onClose={() => setSelected(null)}
          >
            <strong>{selected.name}</strong>
            {selected.address && <div>{selected.address}</div>}
          </Popup>
        )}
      </Map>
    </div>
  );
}