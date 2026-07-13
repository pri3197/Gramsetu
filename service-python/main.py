import os
import shutil
import tempfile
import datetime

# Load local environment variables if present
for env_file in ["../.env.local", "../.env", ".env.local", ".env"]:
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    # Remove surrounding quotes if any
                    val = v.strip().strip("'\"")
                    os.environ[k.strip()] = val

# pyrefly: ignore [missing-import]
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from classifier import BirdAudioClassifier
from data_fetcher import DataFetcher
from rag_service import RAGService
from pydantic import BaseModel

app = FastAPI(
    title="GramSetu AI & Data Service",
    description="Python microservice for bird sound classification and public agricultural data aggregation",
    version="1.0.0"
)

# Enable CORS for cross-origin communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Module Optimization ---
# Initializing singleton instances at module scope reduces endpoint overhead
classifier = BirdAudioClassifier()
default_fetcher = DataFetcher()  # Reusable instance for routes that don't pass custom API keys
rag_service = RAGService()

class ChatRequest(BaseModel):
    message: str

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "GramSetu Python API",
        "endpoints": ["/health", "/classify-bird", "/prices", "/diseases"]
    }

@app.get("/health")
def health_check():
    return {"status": "UP", "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

@app.post("/classify-bird")
async def classify_bird(file: UploadFile = File(...)):
    """
    Receives an audio file, analyzes it, and returns the classification result.
    Supported extensions: .wav, .mp3, .webm, .m4a, etc.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".wav", ".webm", ".mp3", ".ogg", ".m4a", ".aac", ".3gp"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format '{ext}'. Please upload an audio file."
        )

    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, f"upload_{os.urandom(8).hex()}{ext}")
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        result = classifier.classify(temp_file_path)
        return result

    except Exception as e:
        print(f"Exception during file upload/analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {str(e)}")
    
    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as cleanup_err:
                print(f"Failed to delete temp file {temp_file_path}: {str(cleanup_err)}")

@app.post("/chat")
def chat(request: ChatRequest):
    """
    RAG-powered chat endpoint.
    """
    try:
        response = rag_service.generate_response(request.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")

@app.get("/prices")
def get_mandi_prices(
    api_key: str = Query(None, description="API Key for data.gov.in (Optional)"),
    state: str = Query(None, description="State name (optional filter)"),
    commodity: str = Query(None, description="Commodity name (optional filter)"),
    market: str = Query(None, description="Market name (optional filter)"),
    start_date: str = Query(None, description="Optional start date (YYYY-MM-DD)"),
    end_date: str = Query(None, description="Optional end date (YYYY-MM-DD)"),
) -> dict:
    """
    Fetches the latest agricultural mandi prices.
    Tries Agmarknet bridge (port 5000) first, then OGD API, then simulated fallback.
    """
    fetcher = DataFetcher(api_key=api_key) if api_key else default_fetcher
    try:
        prices = fetcher.fetch_mandi_prices(
            state=state,
            commodity=commodity,
            market=market,
            start_date=start_date,
            end_date=end_date,
        )
        if not prices:
            return None
        return prices
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch commodity prices: {str(e)}")


@app.get("/prices/wheat-north-india")
def get_wheat_north_india() -> dict:
    """
    Returns Wheat prices across North Indian mandis (Punjab, Haryana, UP, MP, Rajasthan).
    Uses the agmarknet bridge /wheat/north-india convenience endpoint directly.
    This powers the 'Wheat Market Rate' dashboard widget.
    """
    import requests as req
    agmarknet_url = default_fetcher.agmarknet_base_url
    try:
        r = req.get(f"{agmarknet_url}/wheat/north-india", timeout=6)
        if r.status_code == 200:
            data = r.json()
            # Normalise to the same schema as /prices
            records = []
            for rec in data.get("data", []):
                records.append({
                    "state":       rec.get("state", "N/A"),
                    "district":    rec.get("district", "N/A"),
                    "market":      rec.get("market", "N/A"),
                    "commodity":   rec.get("commodity", "Wheat"),
                    "variety":     rec.get("variety", "FAQ"),
                    "min_price":   float(rec.get("min_price", 0)),
                    "max_price":   float(rec.get("max_price", 0)),
                    "modal_price": float(rec.get("modal_price", 0)),
                    "unit":        rec.get("unit", "Quintal"),
                    "last_updated": rec.get("date", datetime.date.today().strftime("%Y-%m-%d")),
                })
            return {
                "count": len(records),
                "avg_modal_price": data.get("avg_modal_price"),
                "region": "North India",
                "source": data.get("source", "agmarknet_bridge"),
                "data": records,
            }
    except Exception as e:
        print(f"[WARN] /prices/wheat-north-india: agmarknet bridge call failed: {e}")

    # Fallback: filter from general prices
    prices = default_fetcher.fetch_mandi_prices(commodity="Wheat")
    north_states = {"Punjab", "Haryana", "Uttar Pradesh", "Madhya Pradesh", "Rajasthan"}
    filtered = [p for p in prices if p.get("state") in north_states]
    if not filtered:
        filtered = [p for p in prices if "wheat" in str(p.get("commodity", "")).lower()]
    avg = round(sum(p["modal_price"] for p in filtered) / len(filtered)) if filtered else None
    return filtered

@app.get("/institutions")
def get_institutions():
    """
    Returns parsed Veterinary Institutions data mapped with geographic nodes.
    """
    try:
        data = default_fetcher.fetch_veterinary_institutions_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compile historical map data: {str(e)}")
    
@app.get("/diseases")
def get_cattle_diseases():
    """
    Retrieves the latest cattle disease outbreaks from PDF.
    """
    try:
        outbreaks = default_fetcher.fetch_cattle_disease_outbreaks()
        return outbreaks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cattle disease outbreaks: {str(e)}")

@app.get("/news")
def get_news():
    """
    Scrapes and returns latest news on agriculture and fisheries.
    """
    try:
        articles = default_fetcher.fetch_news_articles()
        return articles
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch news articles: {str(e)}")

@app.get("/weather/forecast")
def get_weather_forecast():
    try:
        forecasts = default_fetcher.fetch_weather_forecasts()
        return forecasts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/weather/trends")
def get_climate_trends():
    try:
        trends = default_fetcher.fetch_climate_trends()
        return trends
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/weather/groundwater")
def get_groundwater_data():
    """
    Returns annual groundwater table levels and sewage mixing percentage for districts.
    """
    try:
        data = default_fetcher.fetch_groundwater_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch groundwater data: {str(e)}")

@app.get("/fisheries/imd-warnings")
def get_imd_warnings():
    """
    Scrapes and returns the latest live fishermen weather warnings from IMD.
    """
    try:
        warnings = default_fetcher.fetch_imd_fisherman_warnings()
        return warnings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch IMD warnings: {str(e)}")

@app.get("/fisheries/mangroves/historical")
def get_historical_mangroves():
    """
    Returns state-wise historical FSI Mangrove Cover data (2005-2023).
    """
    try:
        data = default_fetcher.fetch_historical_mangroves()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical mangrove data: {str(e)}")

@app.get("/fisheries/fish-map")
def get_fish_map():
    try:
        data = default_fetcher.fetch_fish_map_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch fish map data: {str(e)}")

@app.get("/fisheries/reproduction")
def get_reproduction_bans():
    try:
        data = default_fetcher.fetch_reproduction_bans()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reproduction bans: {str(e)}")

@app.get("/fisheries/trends")
def get_historical_trends():
    try:
        data = default_fetcher.fetch_historical_trends()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical trends: {str(e)}")

@app.get("/fisheries/schemes")
def get_fisheries_schemes():
    try:
        data = default_fetcher.fetch_fisheries_schemes()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch fisheries schemes: {str(e)}")

@app.get("/birds/sightings")
def get_bird_sightings():
    return []

@app.get("/market/products")
def get_market_products():
    return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)