import { useEffect, useMemo, useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "../lib/supabaseClient";
import "./mapStyle.css";

type Container = {
  id: number;
  name: string;
  address: string | null;
  longitude: number | null;
  latitude: number | null;
};

type Material = {
  id: string;
  name: string;
  price: string | null;
  image_class: string | null;
  containers: string;
};

export default function IntMap() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [selected, setSelected] = useState<Container | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
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

  const fetchMaterialsForContainer = async (containerName: string) => {
    setIsLoadingMaterials(true);

    const { data, error } = await supabase
      .from("materials")
      .select("id, name, price, image_class, containers!inner(name)")
      .eq("containers.name", containerName);

    if (error) {
      console.error("Error fetching materials:", error);
      setMaterials([]);
      setIsLoadingMaterials(false);
      return;
    }

    const mappedMaterials = (data ?? []).map((material) => {
      const imageUrl = material.image_class
        ? supabase.storage.from("images").getPublicUrl(material.image_class).data
            .publicUrl
        : null;

      return {
        ...material,
        image_class: imageUrl,
        containers: material.containers?.name ?? "",
      };
    });

    setMaterials(mappedMaterials);
    setIsLoadingMaterials(false);
  };

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
    <div className="map-shell">
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
            onClick={async (event) => {
              event.originalEvent.stopPropagation();

              if (selected?.id === container.id) {
                setSelected(null);
                setMaterials([]);
                return;
              }

              setSelected(container);
              await fetchMaterialsForContainer(container.name);
            }}
          >
            <button
              type="button"
              className="map-marker-button"
              aria-label={container.name}
            >
              <div className="map-marker-pin">
                <div className="map-marker-center" />
              </div>
            </button>
          </Marker>
        ))}

        {selected && selected.longitude !== null && selected.latitude !== null && (
          <Popup
            longitude={selected.longitude}
            latitude={selected.latitude}
            anchor="bottom"
            offset={20}
            closeButton={true}
            closeOnClick={false}
            onClose={() => {
              setSelected(null);
              setMaterials([]);
            }}
          >
            <div className="map-popup-card">
              <h3 className="map-popup-heading">{selected.name}</h3>

              <p className="map-popup-address">
                {selected.address ?? "Ingen adress"}
              </p>

              <div className="map-popup-materials">
                <strong className="map-popup-title">
                  Material i containern
                </strong>

                {isLoadingMaterials ? (
                  <p className="map-popup-empty">Laddar material...</p>
                ) : materials.length > 0 ? (
                  <div className="map-material-scroll">
                    {materials.map((material) => (
                      <article key={material.id} className="map-material-card">
                        <div className="map-material-image-wrap">
                          {material.image_class ? (
                            <img
                              src={material.image_class}
                              alt={material.name}
                              className="map-material-image"
                            />
                          ) : (
                            <span className="map-material-placeholder">
                              Ingen bild
                            </span>
                          )}
                        </div>

                        <h4 className="map-material-name">{material.name}</h4>

                        <p className="map-material-price">
                          {material.price ?? "Pris saknas"}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="map-popup-empty">Inget material hittades.</p>
                )}
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
