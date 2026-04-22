import { useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";


export default function IntMap() {
	const [selected, setSelected] = useState<String | null>(null);
	
	const container = {
		longitude: 17.645408,
		latitude: 59.840538,
		name: "Container A",
	}
    
	return (
		<div style={{ width: "100%", height: "500px" }}>
			<Map
				initialViewState={{
					longitude: 17.647069,
					latitude: 59.839263,
					zoom: 10,
				}}
				style={{ width: "100%", height: "100%" }}
				mapStyle="https://tiles.openfreemap.org/styles/liberty"
			>
				<NavigationControl position="top-right" />

				<Marker
					longitude={container.longitude}
					latitude={container.latitude}
					anchor="bottom"
					onClick={(e) => {
						e.originalEvent.stopPropagation();
						if (selected === "containerA") {
							setSelected(null); // close if already open
						} else {
							setSelected("containerA"); // open
						}
					}}
				>
					<button type="button" style={{ fontSize: "24px", background: "none", border: "none" }}>
						<div
						style={{
							width: "20px",
							height: "20px",
							backgroundColor: "#18a0f5",
							borderRadius: "50% 50% 50% 0",
							transform: "rotate(-45deg)",
							position: "relative"
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
								left: "6px"
							}}
						/>
					</div>
					</button>
				</Marker>

				{selected === "containerA" && (
					<Popup
						longitude={container.longitude}
						latitude={container.latitude}
						anchor="top"
						onClose={() => setSelected(null)}
					>
						{container.name}
					</Popup>
				)}
			</Map>
		</div>
  );
}