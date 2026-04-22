import Map, { Marker, NavigationControl, Popup } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export default function IntMap() {
    return (
        <Map
            initialViewState={{
                longitude: 17.647069,
                latitude: 59.839263,
                zoom: 10
            }}
            style={{ width: "100%", height: "500px" }}
            mapStyle="https://tiles.openfreemap.org/styles/liberty"
        >
            <NavigationControl position="top-right" />
            <Marker longitude={17.645408} latitude={59.840538}>
                📍
            </Marker>
            <Popup longitude={17.645408} latitude={59.840538}>
                Container A
            </Popup>
        </Map>
    );
}