import random
import requests
import datetime

# List of major agricultural states and districts in India for mock datasets
INDIAN_REGIONS = {
    "Punjab": ["Ludhiana", "Amritsar", "Patiala", "Bathinda", "Jalandhar"],
    "Haryana": ["Karnal", "Hisar", "Ambala", "Sirsa", "Rohtak"],
    "Uttar Pradesh": ["Bareilly", "Meerut", "Mathura", "Kanpur", "Varanasi"],
    "Madhya Pradesh": ["Indore", "Bhopal", "Ujjain", "Jabalpur", "Gwalior"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Udaipur"],
    "Maharashtra": ["Pune", "Nagpur", "Nashik", "Aurangabad", "Kolhapur"],
    "Karnataka": ["Dharwad", "Mysore", "Belgaum", "Shimoga", "Tumkur"],
    "Andhra Pradesh": ["Guntur", "Nellore", "Vijayawada", "Kurnool", "Chittoor"],
    "Tamil Nadu": ["Coimbatore", "Madurai", "Salem", "Tiruchirappalli", "Erode"]
}

# Standard commodity profiles with baseline price per quintal (100 kg) in INR
COMMODITIES = {
    "Wheat (Gehun)": {"base_price": 2300, "variance": 150, "unit": "Quintal"},
    "Paddy (Dhan)": {"base_price": 2200, "variance": 120, "unit": "Quintal"},
    "Barley (Jau)": {"base_price": 2000, "variance": 180, "unit": "Quintal"},
    "Maize (Makka)": {"base_price": 1950, "variance": 100, "unit": "Quintal"},
    "Mustard (Sarso)": {"base_price": 5400, "variance": 400, "unit": "Quintal"},
    "Gram (Chana)": {"base_price": 4800, "variance": 250, "unit": "Quintal"},
    "Soyabean": {"base_price": 4300, "variance": 300, "unit": "Quintal"}
}

# Cattle diseases and relevant parameters
CATTLE_DISEASES = {
    "Lumpy Skin Disease (LSD)": {
        "vaccines": ["Lumpy-Provac", "Goat Pox Vaccine (Heterologous)"],
        "severity": "High",
        "transmission": "Vector-borne (mosquitoes, biting flies, ticks)"
    },
    "Foot and Mouth Disease (FMD)": {
        "vaccines": ["FMD Trivalent Vaccine", "Raksha-Ovac"],
        "severity": "Critical",
        "transmission": "Direct contact, aerosol, contaminated feed/water"
    },
    "Brucellosis": {
        "vaccines": ["Brucella Abortus S19 Strain Vaccine"],
        "severity": "Medium",
        "transmission": "Ingestion of contaminated milk, birth fluids"
    },
    "Black Quarter (BQ)": {
        "vaccines": ["BQ Vaccine (Alum Precipitated)"],
        "severity": "High",
        "transmission": "Soil-borne spores entering through wounds or ingestion"
    },
    "Haemorrhagic Septicaemia (HS)": {
        "vaccines": ["HS Oil Adjuvant Vaccine"],
        "severity": "Critical",
        "transmission": "Inhalation, ingestion of contaminated feed"
    }
}

class DataFetcher:
    def __init__(self, api_key: str = None):
        self.api_key = api_key

    def fetch_mandi_prices(self) -> list:
        """
        Fetches commodity prices from data.gov.in.
        Falls back to generating a realistic, randomized live dataset if no API key is set
        or if the API request fails.
        """
        if self.api_key:
            try:
                # Target API URL for Open Govt Data Mandi Prices
                url = f"https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864543d0341?api-key={self.api_key}&format=json&limit=100"
                response = requests.get(url, timeout=8)
                if response.status_code == 200:
                    data = response.json()
                    records = data.get("records", [])
                    if records:
                        processed_prices = []
                        for record in records:
                            processed_prices.append({
                                "state": record.get("state", "N/A"),
                                "district": record.get("district", "N/A"),
                                "market": record.get("market", "N/A"),
                                "commodity": record.get("commodity", "N/A"),
                                "variety": record.get("variety", "N/A"),
                                "min_price": float(record.get("min_price", 0)),
                                "max_price": float(record.get("max_price", 0)),
                                "modal_price": float(record.get("modal_price", 0)),
                                "unit": "Quintal",
                                "last_updated": record.get("arrival_date", datetime.date.today().strftime("%Y-%m-%d"))
                            })
                        return processed_prices
            except Exception as e:
                print(f"Failed to fetch live mandi prices from API: {str(e)}. Falling back to simulation.")

        # Generate realistic data
        return self._generate_simulated_mandi_prices()

    def _generate_simulated_mandi_prices(self) -> list:
        prices = []
        today = datetime.date.today().strftime("%Y-%m-%d")
        
        # Seed based on date to keep it stable within the same day
        seed_day = datetime.date.today().day
        random.seed(seed_day)

        for state, districts in INDIAN_REGIONS.items():
            # Pick a subset of districts for each commodity
            for commodity, config in COMMODITIES.items():
                # Not all commodities are grown everywhere
                if state == "Punjab" and commodity == "Soyabean":
                    continue
                if state == "Tamil Nadu" and commodity == "Barley (Jau)":
                    continue
                
                num_districts = random.randint(1, 3)
                chosen_districts = random.sample(districts, num_districts)

                for district in chosen_districts:
                    base = config["base_price"]
                    variance = config["variance"]
                    
                    # State and crop adjustments
                    state_mod = random.randint(-80, 80)
                    modal_price = base + state_mod + random.randint(-variance, variance)
                    
                    # Ensure price is logical
                    modal_price = max(1000, modal_price)
                    min_price = int(modal_price * 0.93)
                    max_price = int(modal_price * 1.07)
                    
                    prices.append({
                        "state": state,
                        "district": district,
                        "market": f"{district} Mandi",
                        "commodity": commodity,
                        "variety": "Local / FAQ (Fair Average Quality)",
                        "min_price": min_price,
                        "max_price": max_price,
                        "modal_price": modal_price,
                        "unit": config["unit"],
                        "last_updated": today
                    })
                    
        # Reset seed
        random.seed(None)
        return prices

    def fetch_cattle_disease_outbreaks(self) -> list:
        """
        Retrieves cattle disease outbreaks data across India.
        Provides a realistic simulated dataset of active & historical cases.
        """
        # Seed based on month to keep it stable
        seed_month = datetime.date.today().month
        random.seed(seed_month)
        
        outbreaks = []
        disease_names = list(CATTLE_DISEASES.keys())
        today = datetime.date.today()

        # GPS Coordinates approximation for Indian State centers (for Heatmap visualization)
        state_coords = {
            "Punjab": (31.1471, 75.3412),
            "Haryana": (29.0588, 76.0856),
            "Uttar Pradesh": (26.8467, 80.9462),
            "Madhya Pradesh": (22.9734, 78.6569),
            "Rajasthan": (27.0238, 74.2179),
            "Maharashtra": (19.7515, 75.7139),
            "Karnataka": (15.3173, 75.7139),
            "Andhra Pradesh": (15.9129, 79.7400),
            "Tamil Nadu": (11.1271, 78.6569)
        }

        for state, coords in state_coords.items():
            # Generate 0 to 3 active disease outbreaks per state
            num_outbreaks = random.randint(0, 3)
            if num_outbreaks == 0:
                continue
                
            selected_diseases = random.sample(disease_names, num_outbreaks)
            districts = INDIAN_REGIONS[state]

            for disease in selected_diseases:
                district = random.choice(districts)
                disease_info = CATTLE_DISEASES[disease]
                
                # Add slight random offset to state center coords to represent specific districts
                lat = coords[0] + random.uniform(-0.6, 0.6)
                lng = coords[1] + random.uniform(-0.6, 0.6)
                
                cases_count = random.randint(5, 80)
                days_ago = random.randint(1, 30)
                report_date = (today - datetime.timedelta(days=days_ago)).strftime("%Y-%m-%d")
                
                outbreaks.append({
                    "state": state,
                    "district": district,
                    "disease": disease,
                    "latitude": round(lat, 4),
                    "longitude": round(lng, 4),
                    "active_cases": cases_count,
                    "severity": disease_info["severity"],
                    "transmission": disease_info["transmission"],
                    "report_date": report_date,
                    "recommended_vaccines": disease_info["vaccines"]
                })
        
        random.seed(None)
        return outbreaks
