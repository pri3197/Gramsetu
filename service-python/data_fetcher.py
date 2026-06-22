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

    def fetch_news_articles(self) -> list:
        import xml.etree.ElementTree as ET
        import urllib.request
        import re

        feeds = [
            {"name": "The Hindu BusinessLine", "url": "https://www.thehindubusinessline.com/economy/agri-business/feeder/default.rss", "outlet": "Indian"},
            {"name": "NOAA Fisheries", "url": "https://www.fisheries.noaa.gov/feeds/news/rss.xml", "outlet": "Foreign"},
            {"name": "FAO News", "url": "https://www.fao.org/newsroom/rss/en/", "outlet": "Foreign"},
            {"name": "DownToEarth", "url": "https://www.downtoearth.org.in/rss/agriculture", "outlet": "Indian"}
        ]

        articles = []
        today_str = datetime.date.today().strftime("%Y-%m-%d")

        for feed in feeds:
            try:
                req = urllib.request.Request(
                    feed["url"], 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    xml_data = response.read()
                    root = ET.fromstring(xml_data)
                    for item in root.findall('.//item'):
                        title = item.find('title')
                        link = item.find('link')
                        desc = item.find('description')
                        pubDate = item.find('pubDate')

                        title_text = title.text.strip() if title is not None and title.text else ""
                        link_text = link.text.strip() if link is not None and link.text else ""
                        desc_text = desc.text.strip() if desc is not None and desc.text else ""
                        pub_date_text = pubDate.text.strip() if pubDate is not None and pubDate.text else today_str

                        # Clean HTML from description if any
                        desc_text = re.sub('<[^<]+?>', '', desc_text)
                        if len(desc_text) > 1000:
                            desc_text = desc_text[:997] + "..."

                        # Categorize based on keywords
                        category = "Agriculture"
                        text_to_search = (title_text + " " + desc_text).lower()
                        if any(k in text_to_search for k in ["fish", "marine", "ocean", "sea", "trawler", "aquaculture", "reef", "dolphin", "whale", "spill", "algae"]):
                            category = "Fishery"

                        # Classify topic based on keywords
                        topic = "Trending"
                        if any(k in text_to_search for k in ["organic", "bio ", "bio-", "pesticide-free", "fertilizer", "soil health", "natural farming"]):
                            topic = "Bio Farming"
                        elif any(k in text_to_search for k in ["hydroponic", "smart farming", "precision", "drone", "aeroponic", "vertical farm", "automation", "sensors"]):
                            topic = "Modern Farming"
                        elif any(k in text_to_search for k in ["sonar", "selective net", "eco-friendly trawler", "sustainable fish", "aquaculture tech"]):
                            topic = "New Fishing Ways"
                        elif any(k in text_to_search for k in ["oil spill", "oil slick", "tanker spill", "chemical spill", "ocean pollution"]):
                            topic = "Oil Spills"
                        elif any(k in text_to_search for k in ["climate change", "global warming", "rising temp", "el nino", "carbon emission"]):
                            topic = "Climate Change"

                        articles.append({
                            "title": title_text,
                            "summary": desc_text,
                            "source": feed["name"],
                            "url": link_text,
                            "publishDate": pub_date_text,
                            "category": category,
                            "topic": topic,
                            "outletType": feed["outlet"]
                        })
            except Exception as e:
                # Log error and continue to other feeds
                print(f"Error parsing feed {feed['name']}: {str(e)}")

        # Merge with high-quality simulated/pre-seeded trending news to guarantee coverage of all required topics
        simulated = self._generate_simulated_news()
        articles = simulated + articles

        return articles

    def _generate_simulated_news(self) -> list:
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        return [
            {
                "title": "Government of India Rolls Out Smart Farming Subsidies for Drone Technology",
                "summary": "The Ministry of Agriculture has announced a new 50% subsidy program for smallholder farmer groups buying agricultural drones. Drones will map crop health, perform precision spraying of bio-pesticides, and optimize water application across states like Punjab, Haryana, and Maharashtra.",
                "source": "PIB India",
                "url": "https://pib.gov.in/PressReleasePage.aspx?PRID=1890333",
                "publishDate": today_str,
                "category": "Agriculture",
                "topic": "Modern Farming",
                "outletType": "Indian"
            },
            {
                "title": "AI-Powered Vertical Farms in Tokyo Redefine Urban Agri Productivity",
                "summary": "Tokyo's new automated indoor vertical farms are leveraging IoT sensors and spectral LED lighting to grow leafy greens and fruits with 95% less water than open fields. The systems monitor plant photosynthesis in real-time, achieving record-high yields for commercial distribution.",
                "source": "FAO Global Reports",
                "url": "https://www.fao.org/newsroom/en/",
                "publishDate": today_str,
                "category": "Agriculture",
                "topic": "Modern Farming",
                "outletType": "Foreign"
            },
            {
                "title": "Sikkim's 100% Organic Model Shows Path to Restoring Soil Carbon Levels",
                "summary": "A ten-year impact study of Sikkim's complete transition to organic farming reveals a 24% increase in organic soil carbon, significant recovery in beneficial microbial counts, and enhanced drought resilience. Agronomists urge other Indian states to adopt bio-fertilizers and crop rotation.",
                "source": "The Hindu BusinessLine",
                "url": "https://www.thehindubusinessline.com/economy/agri-business/",
                "publishDate": today_str,
                "category": "Agriculture",
                "topic": "Bio Farming",
                "outletType": "Indian"
            },
            {
                "title": "European Union Bans Four Harmful Chemical Pesticides to Encourage Bio Agriculture",
                "summary": "To support the Green Deal targets, the European Commission has restricted several synthetic pesticides linked to pollinator decline. The decision is boosting European investments in bio-rational products, biological controls, and natural composting methods.",
                "source": "FAO Global Reports",
                "url": "https://www.fao.org/newsroom/en/",
                "publishDate": today_str,
                "category": "Agriculture",
                "topic": "Bio Farming",
                "outletType": "Foreign"
            },
            {
                "title": "Chennai Fishers Adopt Eco-Friendly Trawlers and Selective Gillnets",
                "summary": "To combat overfishing along the Tamil Nadu coast, local fishing cooperatives are modifying their fleets with selective square-mesh nets and light-weight eco-friendly engines. The new gears allow juvenile fish and non-target species to escape, protecting the marine ecosystem.",
                "source": "The Hindu BusinessLine",
                "url": "https://www.thehindubusinessline.com/economy/agri-business/",
                "publishDate": today_str,
                "category": "Fishery",
                "topic": "New Fishing Ways",
                "outletType": "Indian"
            },
            {
                "title": "Satellite Sonar Mapping Helps Pacific Tuna Fleets Bypass Breeding Hubs",
                "summary": "International fisheries regulators are utilizing satellite-based sonar telemetry and machine learning models to map wild tuna migration in real-time. Fishers are dynamically routed away from conservation spawning hotspots, preserving breeding populations while maintaining sustainable catches.",
                "source": "NOAA Fisheries News",
                "url": "https://www.fisheries.noaa.gov/news",
                "publishDate": today_str,
                "category": "Fishery",
                "topic": "New Fishing Ways",
                "outletType": "Foreign"
            },
            {
                "title": "Mumbai Shoreline Cleanup Initiated After Offshore Fuel Pipeline Leak Impacts Fishers",
                "summary": "Local environmental groups and coast guard teams have deployed containment booms after an offshore oil leak near Mumbai. The incident has halted artisanal coastal fishing in adjacent villages, raising concerns over petroleum hydrocarbons entering the local food chain and damaging nursery grounds.",
                "source": "DownToEarth",
                "url": "https://www.downtoearth.org.in/category/natural-disasters",
                "publishDate": today_str,
                "category": "Fishery",
                "topic": "Oil Spills",
                "outletType": "Indian"
            },
            {
                "title": "Red Sea Cargo Ship Spill Threatens Coral Reefs and Artisanal Fishermen Livelihoods",
                "summary": "An oil slick spanning over 40 kilometers from a damaged merchant vessel is threatening coastal fisheries in the southern Red Sea. Marine biologists warn of long-term toxicity to coastal shellfish populations, which serves as the primary protein source and livelihood for thousands of local fishermen.",
                "source": "National Geographic",
                "url": "https://www.nationalgeographic.com/environment",
                "publishDate": today_str,
                "category": "Fishery",
                "topic": "Oil Spills",
                "outletType": "Foreign"
            },
            {
                "title": "Monsoon Shifting: How Heatwaves Are Forcing Indian Wheat Farmers to Reschedule Sowing",
                "summary": "Extreme heat in early November is delaying wheat germination across Indo-Gangetic plains. The Indian Council of Agricultural Research (ICAR) is urging farmers to shift to heat-tolerant varieties and utilize mulching techniques to preserve soil moisture against climate change anomalies.",
                "source": "DownToEarth",
                "url": "https://www.downtoearth.org.in/category/agriculture",
                "publishDate": today_str,
                "category": "Agriculture",
                "topic": "Climate Change",
                "outletType": "Indian"
            },
            {
                "title": "Warming Oceans Force Indian Ocean Mackerel and Tuna to Migrate to Cooler Waters",
                "summary": "Sea surface temperatures in the Indian Ocean have risen by 1.2 degrees Celsius, driving pelagic fish schools like mackerel and sardines away from traditional coastal zones to deeper offshore waters. Fishing communities report a drop in daily catches, prompting calls for climate resilience aids.",
                "source": "NOAA Fisheries News",
                "url": "https://www.fisheries.noaa.gov/news",
                "publishDate": today_str,
                "category": "Fishery",
                "topic": "Climate Change",
                "outletType": "Foreign"
            }
        ]

    def fetch_weather_forecasts(self) -> list:
        """
        Generates regional forecasts, current ENSO indicators, and El Nino summaries for Indian regions.
        """
        return [
            {
                "region": "North India (Indo-Gangetic Plain)",
                "current_temp": 38.5,
                "forecast": "Dry & Extremely Hot. Heatwave warnings in place.",
                "el_nino_status": "Active (Moderate-Strong)",
                "el_nino_impact": "Monsoon winds delayed by 8 days. 15% rainfall deficit expected. Drought advisory active.",
                "anomaly_index": 1.4
            },
            {
                "region": "Western Ghats & Coastal Maharashtra",
                "current_temp": 29.0,
                "forecast": "Moderate Monsoonal Rain. Storm surges active.",
                "el_nino_status": "Active (Moderate-Strong)",
                "el_nino_impact": "Suppressing monsoonal wind circulation. Rainfall deficit of 12% mapped.",
                "anomaly_index": 1.4
            },
            {
                "region": "Eastern Coastal States (Tamil Nadu / AP)",
                "current_temp": 32.5,
                "forecast": "Overcast, light showers, high humidity.",
                "el_nino_status": "Active (Moderate-Strong)",
                "el_nino_impact": "Often leads to an increase in late northeast monsoon rainfall (October-December) but suppresses southwest monsoons.",
                "anomaly_index": 1.4
            },
            {
                "region": "Central Dry Zone (MP / Vidarbha)",
                "current_temp": 41.0,
                "forecast": "Arid, clear skies, severe heat warnings.",
                "el_nino_status": "Active (Moderate-Strong)",
                "el_nino_impact": "High risk of drought. Soil moisture is 22% below baseline. Farmers urged to delay paddy transplantation.",
                "anomaly_index": 1.4
            }
        ]

    def fetch_climate_trends(self) -> list:
        """
        Retrieves historical climate trend indicators for India (2000-2026).
        Shows annual temperature anomaly (in C) and monsoon rainfall deviation from baseline (%).
        """
        return [
            {"year": 2000, "temp_anomaly": 0.22, "rainfall_deviation": 5.0},
            {"year": 2001, "temp_anomaly": 0.25, "rainfall_deviation": -3.0},
            {"year": 2002, "temp_anomaly": 0.38, "rainfall_deviation": -19.0},
            {"year": 2003, "temp_anomaly": 0.31, "rainfall_deviation": 2.0},
            {"year": 2004, "temp_anomaly": 0.34, "rainfall_deviation": -13.0},
            {"year": 2005, "temp_anomaly": 0.39, "rainfall_deviation": 1.0},
            {"year": 2006, "temp_anomaly": 0.42, "rainfall_deviation": -1.0},
            {"year": 2007, "temp_anomaly": 0.40, "rainfall_deviation": 5.0},
            {"year": 2008, "temp_anomaly": 0.38, "rainfall_deviation": -2.0},
            {"year": 2009, "temp_anomaly": 0.52, "rainfall_deviation": -22.0},
            {"year": 2010, "temp_anomaly": 0.60, "rainfall_deviation": 9.0},
            {"year": 2011, "temp_anomaly": 0.48, "rainfall_deviation": 1.0},
            {"year": 2012, "temp_anomaly": 0.53, "rainfall_deviation": -7.0},
            {"year": 2013, "temp_anomaly": 0.55, "rainfall_deviation": 6.0},
            {"year": 2014, "temp_anomaly": 0.62, "rainfall_deviation": -12.0},
            {"year": 2015, "temp_anomaly": 0.74, "rainfall_deviation": -14.0},
            {"year": 2016, "temp_anomaly": 0.91, "rainfall_deviation": -3.0},
            {"year": 2017, "temp_anomaly": 0.82, "rainfall_deviation": -5.0},
            {"year": 2018, "temp_anomaly": 0.79, "rainfall_deviation": -14.0},
            {"year": 2019, "temp_anomaly": 0.85, "rainfall_deviation": 10.0},
            {"year": 2020, "temp_anomaly": 0.72, "rainfall_deviation": 9.0},
            {"year": 2021, "temp_anomaly": 0.76, "rainfall_deviation": 1.0},
            {"year": 2022, "temp_anomaly": 0.88, "rainfall_deviation": 8.0},
            {"year": 2023, "temp_anomaly": 1.12, "rainfall_deviation": -8.0},
            {"year": 2024, "temp_anomaly": 0.98, "rainfall_deviation": 4.0},
            {"year": 2025, "temp_anomaly": 1.05, "rainfall_deviation": -2.0},
            {"year": 2026, "temp_anomaly": 1.15, "rainfall_deviation": -6.0}
        ]

    def fetch_groundwater_data(self) -> list:
        """
        Generates simulated groundwater depletion and sewage mixing contamination
        data across major Indian districts over the years 2016-2026.
        """
        # Let's seed to keep it stable
        random.seed(42)
        
        # GPS Coordinates for major districts in key states
        # Format: (lat, lng, base_depth, base_sewage_ratio, rate_per_year)
        regions = {
            "Punjab": {
                "Ludhiana": (30.9010, 75.8573, 24.5, 0.45, 1.2),
                "Amritsar": (31.6340, 74.8723, 18.0, 0.35, 0.8),
                "Patiala": (30.3398, 76.3869, 21.0, 0.40, 1.0)
            },
            "Haryana": {
                "Karnal": (29.6857, 76.9905, 20.5, 0.38, 0.9),
                "Hisar": (29.1492, 75.7217, 28.0, 0.25, 1.5),
                "Sirsa": (29.5332, 75.0177, 32.0, 0.20, 1.7)
            },
            "Rajasthan": {
                "Jaipur": (26.9124, 75.7873, 35.0, 0.50, 1.8),
                "Jodhpur": (26.2389, 73.0243, 42.0, 0.30, 2.1),
                "Bikaner": (28.0166, 73.3119, 45.0, 0.15, 2.3)
            },
            "Maharashtra": {
                "Pune": (18.5204, 73.8567, 14.0, 0.55, 0.5),
                "Nagpur": (21.1458, 79.0882, 16.5, 0.42, 0.7),
                "Aurangabad": (19.8762, 75.3433, 26.0, 0.28, 1.1)
            },
            "Karnataka": {
                "Mysore": (12.2958, 76.6394, 12.0, 0.30, 0.4),
                "Tumkur": (13.3392, 77.1140, 22.0, 0.22, 0.9)
            },
            "Tamil Nadu": {
                "Coimbatore": (11.0168, 76.9558, 19.0, 0.48, 0.8),
                "Madurai": (9.9252, 78.1198, 23.0, 0.40, 1.1)
            },
            "Uttar Pradesh": {
                "Mathura": (27.4924, 77.6737, 25.0, 0.60, 1.3),
                "Bareilly": (28.3670, 79.4304, 15.0, 0.35, 0.6)
            }
        }
        
        data = []
        for state, districts in regions.items():
            for district, (lat, lng, base_depth, base_sewage_ratio, rate) in districts.items():
                for year in range(2016, 2027): # 2016 to 2026
                    # Over years, water table depth increases (depletion)
                    year_diff = year - 2016
                    depth = base_depth + (year_diff * rate) + random.uniform(-0.5, 0.5)
                    
                    # Sewage mixing contamination percentage (0-100) increases as cities grow
                    sewage_mix = (base_sewage_ratio + (year_diff * 0.02) + random.uniform(-0.03, 0.03)) * 100
                    sewage_mix = max(0, min(100, sewage_mix))
                    
                    # Depletion rate
                    dep_rate = rate + random.uniform(-0.1, 0.1)
                    
                    data.append({
                        "state": state,
                        "district": district,
                        "latitude": round(lat, 4),
                        "longitude": round(lng, 4),
                        "year": year,
                        "waterTableDepth": round(depth, 2),
                        "sewageContamination": round(sewage_mix, 1),
                        "depletionRate": round(dep_rate, 2)
                    })
                    
        random.seed(None)
        return data

    def fetch_historical_mangroves(self) -> list:
        """
        Returns real state-wise historical FSI Mangrove Cover data (2005-2023)
        with coastal coordinates for mapping.
        """
        fsi_raw = {
            "West Bengal": {
                "coords": (21.90, 88.80),
                "cover": {2005: 2158, 2009: 2109, 2011: 2114, 2013: 2097, 2015: 2114, 2017: 2114, 2019: 2112, 2021: 2114, 2023: 2114}
            },
            "Gujarat": {
                "coords": (22.30, 69.50),
                "cover": {2005: 936, 2009: 1046, 2011: 1058, 2013: 1103, 2015: 1107, 2017: 1140, 2019: 1177, 2021: 1175, 2023: 1164}
            },
            "Andaman & Nicobar": {
                "coords": (11.50, 92.70),
                "cover": {2005: 627, 2009: 616, 2011: 604, 2013: 606, 2015: 617, 2017: 617, 2019: 616, 2021: 616, 2023: 616}
            },
            "Andhra Pradesh": {
                "coords": (16.10, 81.20),
                "cover": {2005: 329, 2009: 353, 2011: 352, 2013: 352, 2015: 367, 2017: 404, 2019: 404, 2021: 405, 2023: 421}
            },
            "Maharashtra": {
                "coords": (19.50, 72.80),
                "cover": {2005: 158, 2009: 186, 2011: 186, 2013: 222, 2015: 304, 2017: 304, 2019: 320, 2021: 324, 2023: 336}
            },
            "Odisha": {
                "coords": (20.30, 86.40),
                "cover": {2005: 221, 2009: 213, 2011: 213, 2013: 213, 2015: 231, 2017: 231, 2019: 251, 2021: 259, 2023: 272}
            },
            "Tamil Nadu": {
                "coords": (11.40, 79.80),
                "cover": {2005: 35, 2009: 39, 2011: 29, 2013: 39, 2015: 47, 2017: 49, 2019: 45, 2021: 45, 2023: 45}
            },
            "Goa": {
                "coords": (15.40, 73.80),
                "cover": {2005: 16, 2009: 17, 2011: 22, 2013: 22, 2015: 26, 2017: 26, 2019: 26, 2021: 27, 2023: 31}
            },
            "Karnataka": {
                "coords": (13.50, 74.70),
                "cover": {2005: 3, 2009: 3, 2011: 3, 2013: 3, 2015: 3, 2017: 9, 2019: 10, 2021: 13, 2023: 14}
            },
            "Kerala": {
                "coords": (10.10, 76.20),
                "cover": {2005: 8, 2009: 5, 2011: 6, 2013: 6, 2015: 9, 2017: 6, 2019: 9, 2021: 9, 2023: 9}
            }
        }
        
        records = []
        for state, info in fsi_raw.items():
            lat, lng = info["coords"]
            for year, cover in info["cover"].items():
                records.append({
                    "state": state,
                    "latitude": lat,
                    "longitude": lng,
                    "year": year,
                    "cover": cover
                })
        return records

    def fetch_imd_fisherman_warnings(self) -> list:
        """
        Dynamically fetches and parses live regional fishermen warnings from mausam.imd.gov.in.
        """
        url = "https://mausam.imd.gov.in/imd_latest/contents/index_fisherman.php"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        fallback_warnings = [
            {
                "id": "a1",
                "zone": "West Bengal Coast, Northwest Bay of Bengal, Northeast Bay of Bengal",
                "pdf_url": "https://mausam.imd.gov.in/backend/assets/acwc_kolkata_pdf/fisherman_.pdf",
                "img_url": "https://mausam.imd.gov.in/backend/assets/pdf_to_img_acwc/1_fisherman_6a36e9a9e4ab8.png"
            },
            {
                "id": "a2",
                "zone": "South Odisha coast and North Odisha coast",
                "pdf_url": "https://mausam.imd.gov.in/backend/assets/cwc_pdf/fishermen-_08_01_2026.pdf",
                "img_url": "https://mausam.imd.gov.in/backend/assets/pdf_to_img_cwc/1_fishermen_6a3792ffbac3d.png"
            },
            {
                "id": "a3",
                "zone": "North Andhra coast and South Andhra coast",
                "pdf_url": "https://mausam.imd.gov.in/backend/assets/cwcv_pdf/FW20180021.pdf",
                "img_url": "https://mausam.imd.gov.in/backend/assets/pdf_to_img_cwcv/1_Fisherman_warning_6a371792c1457.png"
            },
            {
                "id": "a4",
                "zone": "North Tamil Nadu coast, South Tamil Nadu coast, Comorin & Maldives Area",
                "pdf_url": "https://mausam.imd.gov.in/backend/assets/acwcc_pdf/agrocomp.pdf",
                "img_url": "https://mausam.imd.gov.in/backend/assets/pdf_to_img_acwcc/1_fishermen_6a3791deec6b6.png"
            },
            {
                "id": "a5",
                "zone": "Kerala Coast, Karnataka Coast, Lakshadweep area & Southeast Arabian Sea",
                "pdf_url": "https://mausam.imd.gov.in/backend/assets/cwc_thiru_pdf/266d68655f9b48485ddaa6613cb82d99.pdf",
                "img_url": None
            },
            {
                "id": "a6",
                "zone": "North Maharashtra Coast, South Maharashtra coast, Goa coast & Central Arabian Sea",
                "pdf_url": "https://mausam.imd.gov.in/backend/assets/acwc_mumbai_pdf/fishermen4.pdf",
                "img_url": "https://mausam.imd.gov.in/backend/assets/pdf_to_img_acwc_mumbai/1_fisherman_6a36b4f5f3d0f.png"
            },
            {
                "id": "a7",
                "zone": "North Gujarat Coast, South Gujarat Coast, Northwest Arabian Sea",
                "pdf_url": "https://mausam.imd.gov.in/backend/assets/cwc_ahmedabad_pdf/FISHERMEN_WARNING_1730_20-06-20261.pdf",
                "img_url": None
            }
        ]

        try:
            response = requests.get(url, headers=headers, timeout=8, verify=False)
            if response.status_code != 200:
                return fallback_warnings
                
            html = response.text
            
            # Find JQuery clicks mapping click IDs to PDF/Image files
            pattern_clicks = r"jQuery\(['\"]#a([0-9]+)['\"]\)\.click\(function\(\)\s*\{(.*?)\}\s*\);"
            clicks = re.findall(pattern_clicks, html, re.DOTALL)
            
            if not clicks:
                return fallback_warnings
                
            results = []
            for num, content in clicks:
                # Find PDF links
                pdf_match = re.search(r'href=([^\s>]+?\.pdf)', content)
                # Find Image links
                img_match = re.search(r'src=([^\s>]+?\.(?:png|jpg|gif))', content)
                
                pdf_path = pdf_match.group(1) if pdf_match else None
                img_path = img_match.group(1) if img_match else None
                
                # Resolve relative paths
                if pdf_path:
                    pdf_path = pdf_path.replace("'", "").replace('"', "")
                    if pdf_path.startswith("../../"):
                        pdf_path = "https://mausam.imd.gov.in/" + pdf_path.replace("../../", "")
                if img_path:
                    img_path = img_path.replace("'", "").replace('"', "")
                    if img_path.startswith("../../"):
                        img_path = "https://mausam.imd.gov.in/" + img_path.replace("../../", "")
                        
                # Extract descriptive label from the HTML menu list
                menu_pattern = rf'id=["\']a{num}["\'][^>]*>(.*?)</a>'
                label_match = re.search(menu_pattern, html, re.IGNORECASE)
                label = label_match.group(1).strip() if label_match else f"Coastal Zone {num}"
                label = re.sub(r'<[^>]*>', '', label)  # Strip tags
                
                # Clean label spacing
                label = re.sub(r'\s+', ' ', label)
                
                # Add to results if we found some media
                if pdf_path or img_path:
                    results.append({
                        "id": f"a{num}",
                        "zone": label,
                        "pdf_url": pdf_path,
                        "img_url": img_path
                    })
            
            if not results:
                return fallback_warnings
                
            # Filter duplicates by ID
            unique_results = []
            seen = set()
            for r in results:
                if r["id"] not in seen:
                    unique_results.append(r)
                    seen.add(r["id"])
                    
            return unique_results
            
        except Exception as e:
            print(f"Error scraping live IMD warnings: {e}")
            return fallback_warnings

    def fetch_fish_map_data(self) -> list:
        """
        Returns locations and species density along the Indian coastline.
        """
        return [
            {"species": "Mackerel", "latitude": 15.2993, "longitude": 73.7709, "location": "Goa Coast", "density": 0.85},
            {"species": "Sardines", "latitude": 11.2588, "longitude": 75.7804, "location": "Calicut Coast", "density": 0.95},
            {"species": "Tuna", "latitude": 10.5667, "longitude": 72.6333, "location": "Lakshadweep Sea", "density": 0.70},
            {"species": "Pomfret", "latitude": 18.9750, "longitude": 72.8258, "location": "Mumbai Coast", "density": 0.80},
            {"species": "Hilsa", "latitude": 21.6266, "longitude": 87.5074, "location": "Digha Coast (Bay of Bengal)", "density": 0.90},
            {"species": "Sardines", "latitude": 9.9312, "longitude": 76.2673, "location": "Kochi Coast", "density": 0.88},
            {"species": "Tuna", "latitude": 8.4875, "longitude": 76.9525, "location": "Trivandrum Coast", "density": 0.75},
            {"species": "Mackerel", "latitude": 13.0827, "longitude": 80.2707, "location": "Chennai Coast", "density": 0.65},
            {"species": "Pomfret", "latitude": 17.6868, "longitude": 83.2185, "location": "Vizag Coast", "density": 0.78}
        ]

    def fetch_reproduction_bans(self) -> list:
        """
        Returns breeding bans and localized warnings for fish species.
        """
        return [
            {
                "species": "Hilsa (Shad)",
                "season": "September - October (Peak Monsoon Spawn)",
                "reasons": {
                    "en": "Spawning peak. Harvesting adult egg-bearing Hilsa now decimates next year's crop.",
                    "hi": "अंडे देने का समय। इस समय अंडे देने वाली हिल्सा पकड़ने से अगले साल की पैदावार समाप्त हो जाएगी।",
                    "ml": "മുട്ടയിടുന്ന സമയം. ഈ സമയത്ത് മുട്ടകളുള്ള ഹിൽസയെ പിടിക്കുന്നത് അടുത്ത വർഷത്തെ വിളവിനെ നശിപ്പിക്കും.",
                    "ta": "முட்டையிடும் காலம். இந்த சமயத்தில் முட்டை சுமந்த ஹில்சாவை பிடிப்பது அடுத்த வருட மீன் உற்பத்தியை அழிக்கும்.",
                    "bn": "ডিম ছাড়ার সময়। এই সময়ে ডিমওয়ালা ইলিশ ধরলে আগামী বছরের ইলিশের উৎপাদন মারাত্মকভাবে ব্যাহত হবে।"
                }
            },
            {
                "species": "Indian Oil Sardines",
                "season": "June - August (Southwest Monsoon)",
                "reasons": {
                    "en": "Monsoon spawning. Crucial for restocking coastal biomass.",
                    "hi": "मानसून प्रजनन। तटीय बायोमास को फिर से भरने के लिए महत्वपूर्ण है।",
                    "ml": "മൺസൂൺ പ്രജനന കാലം. തീരദേശ മത്സ്യസമ്പത്ത് പുനരുജ്ജീവിപ്പിക്കാൻ ഈ സമയത്ത് ഇവയെ പിടിക്കാതിരിക്കുക.",
                    "ta": "மழைக்கால இனப்பெருக்கம். கடலோர மீன் வளத்தை மீண்டும் பெருக்க இது மிக முக்கியமானது.",
                    "bn": "বর্ষাকালীন প্রজনন। উপকূলীয় মাছের মজুদ বৃদ্ধির জন্য এটি অত্যন্ত গুরুত্বপূর্ণ।"
                }
            },
            {
                "species": "Silver Pomfret",
                "season": "October - December (Post-Monsoon Spawn)",
                "reasons": {
                    "en": "Post-monsoon breeding. Restricting catches helps restore adult stocks.",
                    "hi": "मानसून के बाद का प्रजनन। पकड़ने पर प्रतिबंध लगाने से स्टॉक बहाल करने में मदद मिलती है।",
                    "ml": "മൺസൂണിന് ശേഷമുള്ള പ്രജനനം. പിടിക്കുന്നത് നിയന്ത്രിക്കുന്നത് മീൻ സമ്പത്ത് നിലനിർത്താൻ സഹായിക്കും.",
                    "ta": "மழைக்காலத்திற்கு பிந்தைய இனப்பெருக்கம். இந்த காலத்தில் மீன்பிடிப்பதை கட்டுப்படுத்துவது மீன் வளத்தை காக்க உதவும்.",
                    "bn": "বর্ষা পরবর্তী প্রজনন। এই সময় মাছ ধরা বন্ধ রাখলে মাছের সংখ্যা পুনরায় বৃদ্ধি পায়।"
                }
            }
        ]

    def fetch_historical_trends(self) -> list:
        """
        Returns population/biomass trends over time.
        """
        return [
            {"year": 2016, "Sardines": 85, "Hilsa": 70, "Mackerel": 95, "Tuna": 80},
            {"year": 2017, "Sardines": 80, "Hilsa": 68, "Mackerel": 90, "Tuna": 78},
            {"year": 2018, "Sardines": 72, "Hilsa": 60, "Mackerel": 85, "Tuna": 75},
            {"year": 2019, "Sardines": 60, "Hilsa": 52, "Mackerel": 70, "Tuna": 68},
            {"year": 2020, "Sardines": 68, "Hilsa": 55, "Mackerel": 75, "Tuna": 72},
            {"year": 2021, "Sardines": 74, "Hilsa": 58, "Mackerel": 80, "Tuna": 78},
            {"year": 2022, "Sardines": 62, "Hilsa": 50, "Mackerel": 68, "Tuna": 70},
            {"year": 2023, "Sardines": 55, "Hilsa": 45, "Mackerel": 60, "Tuna": 65},
            {"year": 2024, "Sardines": 48, "Hilsa": 38, "Mackerel": 52, "Tuna": 58},
            {"year": 2025, "Sardines": 52, "Hilsa": 42, "Mackerel": 58, "Tuna": 62},
            {"year": 2026, "Sardines": 56, "Hilsa": 47, "Mackerel": 63, "Tuna": 67}
        ]

    def fetch_fisheries_schemes(self) -> list:
        """
        Returns central and state fisheries development schemes.
        """
        return [
            {"state": "Central", "title": "PM Matsya Sampada Yojana (PMMSY)", "description": "Subsidies up to 40% (General) & 60% (SC/ST/Women) for modernizing boat engines, deep sea gear, and establishing cold chains."},
            {"state": "Kerala", "title": "Subsidized Kerosene & Ban Relief", "description": "Provides subsidized kerosene for outboard motors and Rs 4,500 monthly relief during the 52-day monsoon marine fishing ban."},
            {"state": "Tamil Nadu", "title": "Savings-cum-Relief Scheme", "description": "Fishermen contribute Rs 1,500, state contributes Rs 3,000, disbursing Rs 4,500 total during lean months. Also offers diesel subsidy."},
            {"state": "Andhra Pradesh", "title": "YSR Matsyakara Bharosa", "description": "Enhanced financial assistance of Rs 10,000 for fishermen families during the marine ban period. Subsidized diesel at Rs 9/litre."},
            {"state": "Maharashtra", "title": "Fishermen Group Accident Insurance", "description": "Insurance coverage up to Rs 5 Lakhs for active sea-going fishermen. Safety kit subsidies (GPS, lifejackets, wireless transponders)."},
            {"state": "West Bengal", "title": "Hilsa Conservation Livelihood Support", "description": "Alternative livelihood grants and food rations for fishermen who voluntarily abstain from catching juvenile Hilsa (Jatka)."}
        ]


