import json
from dataclasses import dataclass, field
from typing import List, Dict, Optional

# ==========================================
# 1. PROFILE & SETTINGS DATA MODELS
# ==========================================
@dataclass
class YardSize:
    width: float
    depth: float
    unit: str = "Metric(m)" # Metric(m) or Imperial(ft/in)

@dataclass
class Location:
    latitude: float
    longitude: float

@dataclass
class Weather:
    mode: str = "Live" # Live or Manual
    condition: str = "Clear" # Clear, Cloudy, Overcast, Fog, Rain, Snow, Storm, Hail
    intensity: int = 0 # 0 to 100%

@dataclass
class Settings:
    yard_size: YardSize
    environment: str = "Mountains"
    location: Location = None
    weather: Weather = field(default_factory=Weather)
    hardiness_zone: str = ""
    appearance: str = "Auto"
    
# ==========================================
# 2. CONFIGURATION ITEM CATALOG
# ==========================================
class PlannerItem:
    def __init__(self, name: str, category: str, x: float = 0.0, y: float = 0.0, z: float = 0.0):
        self.name = name
        self.category = category
        self.position = {"x": x, "y": y, "z": z}
        
    def to_dict(self):
        return {
            "name": self.name,
            "category": self.category,
            "position": self.position
        }

class Structure(PlannerItem):
    def __init__(self, name: str, x: float = 0.0, y: float = 0.0):
        # e.g., Greenhouse, Shade House, Screen House, Pergola
        super().__init__(name, category="Structure", x=x, y=y)

class SoilBed(PlannerItem):
    def __init__(self, name: str, x: float = 0.0, y: float = 0.0):
        # e.g., Garden Bed, Ground Bed, High Bed
        super().__init__(name, category="Soil Bed", x=x, y=y)

class Hydroponics(PlannerItem):
    def __init__(self, name: str, x: float = 0.0, y: float = 0.0):
        # e.g., Vertical Tower, Nutrient Film, Ebb & Flow, Dutch Bucket
        super().__init__(name, category="Hydroponics", x=x, y=y)

class Equipment(PlannerItem):
    def __init__(self, name: str, x: float = 0.0, y: float = 0.0):
        # e.g., Water Tank, A/C Unit, Humidifier, Dehumidifier
        super().__init__(name, category="Equipment", x=x, y=y)

class Plant(PlannerItem):
    def __init__(self, name: str, bed_id: str = None, x: float = 0.0, y: float = 0.0):
        super().__init__(name, category="Plant", x=x, y=y)
        self.bed_id = bed_id

# ==========================================
# 3. CORE PLANNER ENGINE
# ==========================================
class GrowDraftEngine:
    def __init__(self):
        self.settings: Settings = None
        self.items: List[PlannerItem] = []
        
    def configure_environment(self, config_payload: Dict):
        """
        Parses the JSON payload mimicking the GrowDraft 'Profile & Settings' panel.
        """
        print("[Engine] Configuring Global Environment...")
        ys_data = config_payload.get("yard_size", {"width": 10, "depth": 10})
        yard_size = YardSize(width=ys_data['width'], depth=ys_data['depth'])
        
        loc_data = config_payload.get("location", {"latitude": 0.0, "longitude": 0.0})
        location = Location(latitude=loc_data['latitude'], longitude=loc_data['longitude'])
        
        w_data = config_payload.get("weather", {})
        weather = Weather(
            mode=w_data.get("mode", "Live"),
            condition=w_data.get("condition", "Clear"),
            intensity=w_data.get("intensity", 0)
        )
        
        self.settings = Settings(
            yard_size=yard_size,
            environment=config_payload.get("environment", "Mountains"),
            location=location,
            weather=weather,
            hardiness_zone=config_payload.get("hardiness_zone", "")
        )
        print(f"  -> Set Yard Size: {self.settings.yard_size.width}m x {self.settings.yard_size.depth}m")
        print(f"  -> Set Weather: {self.settings.weather.mode} - {self.settings.weather.condition} ({self.settings.weather.intensity}%)")
        
    def add_item(self, item: PlannerItem):
        """
        Adds a structural or configuration item to the 3D space.
        """
        self.items.append(item)
        print(f"[Engine] Added {item.category}: {item.name} at {item.position}")
        
    def generate_layout_schema(self) -> str:
        """
        Compiles the entire state into a JSON schema ready to be digested by a frontend 3D renderer.
        """
        schema = {
            "environment": {
                "dimensions": {
                    "width": self.settings.yard_size.width,
                    "depth": self.settings.yard_size.depth
                },
                "backdrop": self.settings.environment,
                "weather": {
                    "condition": self.settings.weather.condition,
                    "intensity": self.settings.weather.intensity
                }
            },
            "objects": [item.to_dict() for item in self.items]
        }
        return json.dumps(schema, indent=4)
        
    def load_default_template(self):
        """
        Loads a comprehensive default garden layout so the user starts with a fully planned space
        instead of a blank canvas.
        """
        print("[Engine] Loading Default Starter Template...")
        # 1. Default Global Settings
        self.configure_environment({
            "yard_size": {"width": 10.0, "depth": 15.0},
            "environment": "Mountains",
            "location": {"latitude": 28.6139, "longitude": 77.2090}, # New Delhi default
            "weather": {"mode": "Live", "condition": "Clear", "intensity": 0},
            "hardiness_zone": "10b"
        })
        
        # 2. Default Structures & Beds
        self.add_item(Structure(name="Basic Polyhouse", x=2.0, y=2.0))
        self.add_item(SoilBed(name="Ground Bed A", x=3.0, y=3.0))
        self.add_item(SoilBed(name="Ground Bed B", x=6.0, y=3.0))
        
        # 3. Default Equipment
        self.add_item(Equipment(name="200L Water Tank", x=1.0, y=14.0))
        
        # 4. Default Plants
        self.add_item(Plant(name="Tomato", bed_id="Ground Bed A", x=3.5, y=3.5))
        self.add_item(Plant(name="Cucumber", bed_id="Ground Bed B", x=6.5, y=3.5))

if __name__ == "__main__":
    # --- TEST EXECUTION: Simulating a User Request ---
    engine = GrowDraftEngine()
    engine.load_default_template()
    
    print("\n=======================================================")
    print("DEFAULT 3D RENDERING PAYLOAD SCHEMA:")
    print("=======================================================")
    print(engine.generate_layout_schema())
