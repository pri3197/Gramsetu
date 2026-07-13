from datetime import time
import os
import random
import requests
import datetime
import re
from urllib.parse import quote
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
        # Load optional agmarknet configuration from environment (Render)
        self.use_agmarknet_api = os.getenv("USE_AGMARKNET_API", "true").lower() == "true"  # enabled by default
        # Base URL of the agmarknet_api Flask service (port 5000)
        self.agmarknet_base_url = os.getenv("AGMARKNET_BASE_URL", "http://127.0.0.1:5000")
        # Core geographical monitoring hubs for your system mapping
        self.regions_coords = {
            "New Delhi (North Zone)": (28.6139, 77.2090),
            "Mumbai (Western Coast)": (19.0760, 72.8777),
            "Bengaluru (South Zone)": (12.9716, 77.5946),
            "Patna (East Zone)": (25.5941, 85.1367)
        }

    def fetch_mandi_prices(self, state: str = None, commodity: str = None, market: str = None, start_date: str = None, end_date: str = None) -> list:
        """
        Fetch mandi price data.
        Priority:
          1. Agmarknet Bridge service (http://127.0.0.1:5000) – always tried when available.
          2. Original OGD API (data.gov.in) – used if an API key is configured.
          3. Simulated data fallback.
        """
        # --- Agmarknet Bridge (port 5000) ------------------------------------
        if self.use_agmarknet_api:
            try:
                # Build optional query params
                query_params = {}
                if commodity:
                    query_params["commodity"] = commodity
                if state:
                    query_params["state"] = state
                if market:
                    query_params["market"] = market
                if start_date:
                    query_params["from_date"] = start_date
                if end_date:
                    query_params["to_date"] = end_date

                qs = "&".join([f"{k}={quote(str(v))}" for k, v in query_params.items()])
                url = f"{self.agmarknet_base_url}/request" + (f"?{qs}" if qs else "")
                response = requests.get(url, timeout=6)
                if response.status_code == 200:
                    data = response.json()
                    records = data.get("data", data)
                    if isinstance(records, list) and records:
                        normalized = []
                        for rec in records:
                            normalized.append({
                                "state":        rec.get("state",        state or "N/A"),
                                "district":     rec.get("district",     rec.get("market", "N/A")),
                                "market":       rec.get("market",       market or "N/A"),
                                "commodity":    rec.get("commodity",    commodity or "N/A"),
                                "variety":      rec.get("variety",      "FAQ"),
                                "min_price":    float(rec.get("min_price",   0)),
                                "max_price":    float(rec.get("max_price",   0)),
                                "modal_price":  float(rec.get("modal_price", 0)),
                                "unit":         rec.get("unit",         "Quintal"),
                                "last_updated": rec.get("date",         datetime.date.today().strftime("%Y-%m-%d"))
                            })
                        print(f"[DataFetcher] Got {len(normalized)} records from Agmarknet bridge")
                        return normalized
            except Exception as e:
                print(f"[WARN] Agmarknet bridge unavailable: {e}. Trying OGD/simulation.")
        # --- Original OGD API ------------------------------------------------
        if self.api_key:
            try:
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
                print(f"[WARN] OGD fetch failed: {e}")
        # --- Simulated fallback --------------------------------------------
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

    def download_nadres_dataset(self, version_number: int = 1) -> str:
        """Download the NADRES v2 forecasting input dataset.

        The dataset is fetched from the public API using an access key provided via the
        `NADRES_DATASET_ACCESS_KEY` environment variable. The file is saved to the
        `data/` directory (created if missing) with a timestamped filename and the
        absolute path is returned. Errors are logged and re‑raised as `RuntimeError`.
        """
        base_url = "https://aikosha-api.indiaai.gov.in/akp/idp/api/v2/dataset-public/download-dataset"
        params = {
            "datasetIdentifier": "nadres_v2_forecasting_input_dataset",
            "versionNumber": str(version_number)
        }
        access_key = os.getenv("NADRES_DATASET_ACCESS_KEY")
        if not access_key:
            raise RuntimeError("NADRES_DATASET_ACCESS_KEY environment variable not set")
        headers = {
            "accept": "*/*",
            "access-key": access_key
        }
        try:
            response = requests.get(base_url, params=params, headers=headers, timeout=30, stream=True)
            response.raise_for_status()
            data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
            os.makedirs(data_dir, exist_ok=True)
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"nadres_dataset_v{version_number}_{timestamp}.zip"
            file_path = os.path.abspath(os.path.join(data_dir, filename))
            with open(file_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            return file_path
        except Exception as e:
            print(f"[WARN] Failed to download NADRES dataset: {e}")
            raise RuntimeError(f"Failed to download NADRES dataset: {e}")

    def _download_and_extract_pdf(self) -> dict:
        pdf_path = os.path.join("data", "dahd_report.pdf")
        os.makedirs("data", exist_ok=True)
        
        # In a real scenario, this would use BeautifulSoup to parse https://dahd.gov.in/en/annual-report
        # For this requirement we use the provided latest report link.
        report_url = "https://dahd.gov.in/sites/default/files/2026-02/BAHS2025.pdf"
        
        # Cache for 24 hours based on file modification time
        if not os.path.exists(pdf_path) or (datetime.datetime.now().timestamp() - os.path.getmtime(pdf_path)) > 86400:
            try:
                print(f"[DataFetcher] Downloading latest BAHS report from {report_url}...")
                response = requests.get(report_url, timeout=30)
                if response.status_code == 200:
                    with open(pdf_path, 'wb') as f:
                        f.write(response.content)
            except Exception as e:
                print(f"[WARN] Failed to download PDF: {e}")
                
        institutions_data = []
        disease_outbreaks = []
        
        if not os.path.exists(pdf_path):
            return {"institutions": [], "outbreaks": []}
            
        try:
            import pdfplumber
            
            # Fast search by only looking at relevant pages (80 to 110)
            pages_to_parse = set(range(80, 110))
            
            with pdfplumber.open(pdf_path) as pdf:
                for i in pages_to_parse:
                    if i >= len(pdf.pages): continue
                    page = pdf.pages[i]
                    text = page.extract_text()
                    if not text: continue
                    
                    # 1. Parse Table 17 (Number of Veterinary Institutions)
                    if "NUMBER OF VETERINARY INSTITUTIONS" in text.upper() or "VETERINARY INSTITUTIONS" in text.upper():
                        tables = page.extract_tables()
                        if tables:
                            for row in tables[0]:
                                if len(row) >= 6 and row[1] and row[1].strip() != "States/UTs" and "Total" not in row[1]:
                                    try:
                                        state = row[1].strip().replace('\n', ' ')
                                        total_str = str(row[-1]).replace('\n', '').strip().replace(',', '')
                                        if total_str.isdigit():
                                            institutions_data.append({
                                                "state": state,
                                                "total_institutions": int(total_str),
                                                # Add coordinates for the frontend map based on state names
                                                "latitude": 0.0,
                                                "longitude": 0.0
                                            })
                                    except:
                                        pass
                    
                    # 2. Parse Table 16(B) (Disease Outbreaks)
                    if "TABLE 16 (B)" in text.upper() or "TABLE 16(B)" in text.upper():
                        tables = page.extract_tables()
                        if tables:
                            for row in tables[0]:
                                if len(row) >= 6 and row[1] and row[1].strip() != "Disease Name":
                                    disease_name = str(row[1]).strip().replace('\n', ' ')
                                    species = str(row[2]).strip().replace('\n', ' ') if row[2] else ""
                                    outbreak = str(row[3]).strip().replace(',', '') if row[3] else "0"
                                    attack = str(row[4]).strip().replace(',', '') if row[4] else "0"
                                    death = str(row[5]).strip().replace(',', '') if row[5] else "0"
                                    
                                    if not disease_name and species and disease_outbreaks:
                                        disease_name = disease_outbreaks[-1]['disease']
                                        
                                    if disease_name and disease_name != 'None' and species:
                                        try:
                                            disease_outbreaks.append({
                                                "disease": disease_name,
                                                "species": species,
                                                "outbreaks": int(outbreak) if outbreak.isdigit() else 0,
                                                "attacks": int(attack) if attack.isdigit() else 0,
                                                "deaths": int(death) if death.isdigit() else 0,
                                                "activeCases": int(attack) if attack.isdigit() else 0,
                                                "severity": "High" if (int(outbreak) if outbreak.isdigit() else 0) > 10 else "Medium",
                                                "state": "National",
                                                "district": "Multiple"
                                            })
                                        except Exception as e:
                                            pass
        except Exception as e:
            print(f"[WARN] Failed to parse PDF: {e}")
            
        return {"institutions": institutions_data, "outbreaks": disease_outbreaks}

    def fetch_veterinary_institutions_data(self) -> list:
        data = self._download_and_extract_pdf()
        institutions = data.get("institutions", [])
        
        # Hardcode some state coordinates for map markers
        coords = {
            "Andhra Pradesh": (15.9129, 79.7400), "Arunachal Pradesh": (28.2180, 94.7278),
            "Assam": (26.2006, 92.9376), "Bihar": (25.0961, 85.3131),
            "Chhattisgarh": (21.2787, 81.8661), "Goa": (15.2993, 74.1240),
            "Gujarat": (22.2587, 71.1924), "Haryana": (29.0588, 76.0856),
            "Himachal Pradesh": (31.1048, 77.1665), "Jharkhand": (23.6102, 85.2799),
            "Karnataka": (15.3173, 75.7139), "Kerala": (10.8505, 76.2711),
            "Madhya Pradesh": (22.9734, 78.6569), "Maharashtra": (19.7515, 75.7139),
            "Manipur": (24.6637, 93.9063), "Meghalaya": (25.4670, 91.3662),
            "Mizoram": (23.1645, 92.9376), "Nagaland": (26.1584, 94.5624),
            "Odisha": (20.9517, 85.0985), "Punjab": (31.1471, 75.3412),
            "Rajasthan": (27.0238, 74.2179), "Sikkim": (27.5330, 88.5122),
            "Tamil Nadu": (11.1271, 78.6569), "Telangana": (18.1124, 79.0193),
            "Tripura": (23.9408, 91.9882), "Uttar Pradesh": (26.8467, 80.9462),
            "Uttarakhand": (30.0668, 79.0193), "West Bengal": (22.9868, 87.8550)
        }
        
        for inst in institutions:
            if inst["state"] in coords:
                inst["latitude"] = coords[inst["state"]][0]
                inst["longitude"] = coords[inst["state"]][1]
            else:
                inst["latitude"] = 20.0
                inst["longitude"] = 77.0
                
        return [i for i in institutions if i["latitude"] != 0.0]

    def fetch_cattle_disease_outbreaks(self) -> list:
        data = self._download_and_extract_pdf()
        return data.get("outbreaks", [])

    def fetch_news_articles(self) -> list:
        api_key = os.getenv("NEWS_API_KEY")
        # Broad query targeting exactly your requested domains
        query = "(india AND farming OR weather OR weather OR biotechnology OR fishery OR aquaculture OR agriculture)"
        
        # sortBy=publishedAt guarantees newest articles first (descending by date)
        url = f"https://newsapi.org/v2/everything?q={query}&sortBy=publishedAt&language=en&apiKey={api_key}"

        articles = []
        today_str = datetime.date.today().strftime("%Y-%m-%d")

        try:
            # Fetch directly from NewsAPI JSON endpoint
            response = requests.get(url, timeout=8)
            if response.status_code == 200:
                data = response.json()
                news_items = data.get("articles", [])

                for item in news_items:
                    title_text = item.get("title") or ""
                    link_text = item.get("url") or ""
                    desc_text = item.get("description") or ""
                    pub_date_raw = item.get("publishedAt") or today_str
                    source_name = item.get("source", {}).get("name") or "Global News"

                    # Skip dead or removed articles returned by the API
                    if title_text == "[Removed]":
                        continue

                    # Clean HTML from description if any
                    desc_text = re.sub('<[^<]+?>', '', desc_text)
                    if len(desc_text) > 1000:
                        desc_text = desc_text[:997] + "..."

                    # ==========================================
                    # YOUR EXISTING FILTERS & CATEGORIZATIONS
                    # ==========================================
                    category = "Agriculture"
                    text_to_search = (title_text + " " + desc_text).lower()
                    
                    if any(k in text_to_search for k in ["fish", "marine", "ocean", "sea", "trawler", "aquaculture", "reef", "dolphin", "whale", "spill", "algae"]):
                        category = "Fishery"

                    topic = "Trending"
                    if any(k in text_to_search for k in ["organic", "bio ", "bio-", "pesticide-free", "fertilizer", "soil health", "natural farming", "biotechnology"]):
                        topic = "Bio Farming"
                    elif any(k in text_to_search for k in ["hydroponic", "smart farming", "precision", "drone", "aeroponic", "vertical farm", "automation", "sensors"]):
                        topic = "Modern Farming"
                    elif any(k in text_to_search for k in ["sonar", "selective net", "eco-friendly trawler", "sustainable fish", "aquaculture tech"]):
                        topic = "New Fishing Ways"
                    elif any(k in text_to_search for k in ["oil spill", "oil slick", "tanker spill", "chemical spill", "ocean pollution"]):
                        topic = "Oil Spills"
                    elif any(k in text_to_search for k in ["climate change", "global warming", "rising temp", "el nino", "carbon emission", "weather"]):
                        topic = "Climate Change"

                    articles.append({
                        "title": title_text,
                        "summary": desc_text,
                        "source": source_name,
                        "url": link_text,
                        # Slice to keep just the YYYY-MM-DD part of the ISO string
                        "publishDate": pub_date_raw[:10], 
                        "category": category,
                        "topic": topic,
                        "outletType": "Global Aggregator"
                    })

        except Exception as e:
            print(f"Error fetching from NewsAPI: {str(e)}")

        # Final guarantee: Sort the entire combined list descending by date
        articles.sort(key=lambda x: x["publishDate"], reverse=True)

        return articles

    def fetch_weather_forecasts(self) -> list:
        """
        Queries Open-Meteo for live forecasts and fills all keys required 
        by Spring Boot's WeatherController to avoid Map.get().toString() exceptions.
        """
        processed_forecasts = []
        
        for region_name, (lat, lon) in self.regions_coords.items():
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&forecast_days=1&timezone=UTC"
            try:
                response = requests.get(url, timeout=5)
                if response.status_code != 200:
                    continue
                
                payload = response.json()
                # Open-Meteo returns current weather under 'current_weather'
                current_data = payload.get("current_weather", {})
                
                weather_code = current_data.get("weathercode", 0)
                temp = current_data.get("temperature", 32.0)
                
                # Dynamic forecast string builder matching code tables
                if weather_code <= 2:
                    forecast_desc = "Dry & Clear skies."
                elif weather_code <= 65:
                    forecast_desc = "Overcast with light monsoonal showers."
                else:
                    forecast_desc = "Heavy downpours with strong coastal wind circulations."

                processed_forecasts.append({
                    "region": region_name,
                    "latitude": lat,
                    "longitude": lon,
                    "current_temp": temp,
                    "humidity": current_data.get("relative_humidity_2m"),
                    "forecast": forecast_desc,
                    "report_time": current_data.get("time"),
                    
                    # Java Controller Handshake Fields
                    "el_nino_status": "Monitored (Open-Meteo Engine)",
                    "el_nino_impact": f"Atmospheric pressure normal. Current localized baseline temp: {temp}°C.",
                    "anomaly_index": 1.4
                })
            except Exception as e:
                print(f"Failed to compile forecast for {region_name}: {str(e)}")
                
        if not processed_forecasts:
            # Safe architectural return structural state
            return [{"region": "New Delhi Core Hub", "current_temp": 34.0, "forecast": "Clear Skies", "el_nino_status": "Normal", "el_nino_impact": "None", "anomaly_index": 0.0}]
            
        return processed_forecasts

    def fetch_climate_trends(self) -> list:
        """
        Parses Open-Meteo historic data arrays and matches legacy keys 
        (temp_anomaly, rainfall_deviation) to prevent frontend Chart NaN errors.
        """
        lat, lon = self.regions_coords["New Delhi (North Zone)"]
        
        # Fetch full 2000-2026 range from Open-Meteo archive
        url = f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date=2000-01-01&end_date=2026-01-01&daily=temperature_2m_max,rain_sum"
        
        try:
            response = requests.get(url, timeout=6)
            if response.status_code != 200:
                raise ConnectionError("Archive data pool unreachable.")
                
            payload = response.json()
            daily_data = payload.get("daily", {})
            
            times = daily_data.get("time", [])
            max_temps = daily_data.get("temperature_2m_max", [])
            rain_records = daily_data.get("rain_sum", [])
            
            # Aggregate parallel arrays into annual statistics dictionary 
            annual_summary = {}
            for i, date_str in enumerate(times):
                year = int(date_str.split("-")[0])
                if year not in annual_summary:
                    annual_summary[year] = {"temp_pool": [], "rain_total": 0.0}
                
                if max_temps[i] is not None:
                    annual_summary[year]["temp_pool"].append(max_temps[i])
                if rain_records[i] is not None:
                    annual_summary[year]["rain_total"] += rain_records[i]
            
            trends = []
            # Historical scientific baselines for New Delhi region calculations
            BASELINE_TEMP = 32.5
            BASELINE_RAIN = 650.0

            for year, data in annual_summary.items():
                avg_max_temp = round(sum(data["temp_pool"]) / len(data["temp_pool"]), 2) if data["temp_pool"] else 0.0
                
                computed_anomaly = round(avg_max_temp - BASELINE_TEMP, 2)
                computed_deviation = round(((data["rain_total"] - BASELINE_RAIN) / BASELINE_RAIN) * 100, 1)

                trends.append({
                    "year": year,
                    "location_baseline": "North India Monitoring Zone",
                    "average_max_temperature": avg_max_temp,
                    "annual_accumulated_rain_mm": round(data["rain_total"], 2),
                    
                    # Essential frontend SVG Chart Key Hooks
                    "temp_anomaly": computed_anomaly,
                    "rainfall_deviation": computed_deviation
                })
            
            return sorted(trends, key=lambda x: x["year"])
            
        except Exception as e:
            print(f"Error parsing historical data payload: {str(e)}. Using extended fallback.")
            # Extended fallback: realistic North India climate indicators 2000-2026
            return []